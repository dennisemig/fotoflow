// Mail: læser dennis@vaniagraphics.dk over IMAP og sender over SMTP (cPanel/Nordicway).
// Kræver login som administrator. Login til mailserveren ligger kun i Vercel:
//   MAIL_USER  fx dennis@vaniagraphics.dk
//   MAIL_PASS  mailkontoens adgangskode (samme som i Roundcube)
//   IMAP_HOST  fx cp17.nordicway.dk   (IMAP_PORT, standard 993)
//   SMTP_HOST  standard samme som IMAP_HOST (SMTP_PORT, standard 465)
//   MAIL_NAVN  afsendernavn, standard "Vania Graphics"
//
// Kun headers og tekstdele hentes – aldrig hele mails med store vedhæftninger,
// fordi Vercel højst kan sende 4,5 MB tilbage og har kort timeout.
import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import MailComposer from 'nodemailer/lib/mail-composer/index.js'
import { kraevAdminLogin } from './_lib/mail-login.js'
import { mailHtml, mailTekst } from './_lib/signatur.js'

export const config = { maxDuration: 30 }

const MAIL_USER = process.env.MAIL_USER
const MAIL_PASS = process.env.MAIL_PASS
const IMAP_HOST = process.env.IMAP_HOST
const IMAP_PORT = Number(process.env.IMAP_PORT || 993)
const SMTP_HOST = process.env.SMTP_HOST || IMAP_HOST
const SMTP_PORT = Number(process.env.SMTP_PORT || 465)
const MAIL_NAVN = process.env.MAIL_NAVN || 'Vania Graphics'

const PR_SIDE = 50
const MAX_SVAR_BYTES = 4 * 1024 * 1024 // vedhæftninger over dette kan ikke hentes gennem Vercel
const MAX_INLINE_BYTES = 2.5 * 1024 * 1024 // indlejrede billeder i html (cid:) samlet

function nyKlient() {
  return new ImapFlow({
    host: IMAP_HOST, port: IMAP_PORT, secure: IMAP_PORT === 993,
    auth: { user: MAIL_USER, pass: MAIL_PASS },
    logger: false, socketTimeout: 25000, greetingTimeout: 10000
  })
}

async function medImap(fn) {
  const klient = nyKlient()
  await klient.connect()
  try { return await fn(klient) } finally { await klient.logout().catch(() => {}) }
}

// ---------- Hjælpere ----------

const adr = a => ({ navn: a?.name || '', email: (a?.address || '').toLowerCase() })
const adrListe = l => (l || []).map(adr).filter(a => a.email)

function parseReferences(buf) {
  if (!buf) return []
  const tekst = buf.toString('utf8').replace(/^references:\s*/i, '')
  return tekst.match(/<[^<>\s]+>/g) || []
}

function harVedhaeftning(node) {
  if (!node) return false
  if (node.disposition === 'attachment') return true
  if (node.childNodes) return node.childNodes.some(harVedhaeftning)
  return false
}

function tilHeader(msg, mappe) {
  const e = msg.envelope || {}
  const flags = msg.flags || new Set()
  return {
    uid: msg.uid,
    mappe,
    messageId: e.messageId || null,
    inReplyTo: e.inReplyTo || null,
    references: parseReferences(msg.headers),
    fra: adr(e.from?.[0]),
    til: adrListe(e.to),
    cc: adrListe(e.cc),
    emne: e.subject || '(intet emne)',
    dato: (e.date || msg.internalDate || null),
    laest: flags.has('\\Seen'),
    besvaret: flags.has('\\Answered'),
    stoerrelse: msg.size || 0,
    vedhaeftning: harVedhaeftning(msg.bodyStructure)
  }
}

const HEADER_FELTER = { uid: true, envelope: true, flags: true, size: true, internalDate: true, bodyStructure: true, headers: ['references'] }

async function hentHeaders(klient, uids, mappe) {
  if (!uids.length) return []
  const ud = []
  for await (const msg of klient.fetch(uids.join(','), HEADER_FELTER, { uid: true })) ud.push(tilHeader(msg, mappe))
  return ud.sort((a, b) => new Date(b.dato) - new Date(a.dato))
}

async function mapper(klient) {
  const liste = await klient.list()
  return liste
    .filter(m => !(m.flags && m.flags.has('\\Noselect')))
    .map(m => ({ sti: m.path, navn: m.name, special: m.specialUse || null }))
}

const SKJULTE = ['\\Junk', '\\Trash', '\\Drafts']
function erSoegbar(m) {
  if (SKJULTE.includes(m.special)) return false
  return !/(^|\.)(spam|junk|trash|papirkurv|drafts|kladder)$/i.test(m.sti)
}

// Find tekst- og vedhæftningsdele i en mails struktur
function gennemgaaStruktur(node, ud = { tekst: null, html: null, vedhaeftninger: [], inline: [] }) {
  if (!node) return ud
  if (node.childNodes?.length) { node.childNodes.forEach(n => gennemgaaStruktur(n, ud)); return ud }
  const type = (node.type || '').toLowerCase()
  const filnavn = node.dispositionParameters?.filename || node.parameters?.name || null
  const erVedhaeftning = node.disposition === 'attachment' || (filnavn && !type.startsWith('text/') && node.disposition !== 'inline')
  if (!erVedhaeftning && type === 'text/plain' && !ud.tekst) ud.tekst = node
  else if (!erVedhaeftning && type === 'text/html' && !ud.html) ud.html = node
  else if (node.id && type.startsWith('image/') && node.disposition !== 'attachment') ud.inline.push(node)
  else if (node.part) {
    ud.vedhaeftninger.push({
      part: node.part, filnavn: filnavn || 'vedhaeftning', type, stoerrelse: node.size || 0,
      // Størrelsen er den kodede (base64 ≈ +37 %)
      kanHentes: (node.size || 0) * 0.74 < MAX_SVAR_BYTES
    })
  }
  return ud
}

async function hentDel(klient, uid, part) {
  const { content } = await klient.download(uid, part, { uid: true })
  const bidder = []
  for await (const b of content) bidder.push(b)
  return Buffer.concat(bidder)
}

// ---------- Handlinger ----------

async function liste(klient, { mappe = 'INBOX', side = 1, q = '' }) {
  const lock = await klient.getMailboxLock(mappe)
  try {
    const kriterie = q
      ? { or: [{ subject: q }, { from: q }, { to: q }, { body: q }] }
      : { all: true }
    const uids = (await klient.search(kriterie, { uid: true })) || []
    uids.sort((a, b) => b - a)
    const start = (Math.max(1, Number(side)) - 1) * PR_SIDE
    const mails = await hentHeaders(klient, uids.slice(start, start + PR_SIDE), mappe)
    return { mails, total: uids.length, side: Number(side), prSide: PR_SIDE }
  } finally { lock.release() }
}

// Søger i alle almindelige mapper (indbakke, sendt, arkiv – ikke spam/papirkurv/kladder)
// efter mails til/fra bestemte adresser, med bestemte tekster eller bestemte Message-ID'er.
async function soeg(klient, { emails = [], tekster = [], messageIds = [], dage = 365, max = 150 }) {
  const enkelte = []
  for (const e of emails.filter(Boolean).slice(0, 20)) enkelte.push({ from: e }, { to: e }, { cc: e })
  for (const t of tekster.filter(t => t && t.length >= 3).slice(0, 10)) enkelte.push({ subject: t }, { body: t })
  for (const id of messageIds.filter(Boolean).slice(0, 50)) enkelte.push({ header: { 'message-id': id } }, { header: { references: id } })
  if (!enkelte.length) return { mails: [] }

  const alle = (await mapper(klient)).filter(erSoegbar)
  const fundet = []
  for (const m of alle) {
    let lock
    try { lock = await klient.getMailboxLock(m.sti) } catch { continue }
    try {
      const kriterie = { or: enkelte }
      if (dage) kriterie.since = new Date(Date.now() - dage * 864e5)
      const uids = ((await klient.search(kriterie, { uid: true })) || []).sort((a, b) => b - a).slice(0, max)
      fundet.push(...await hentHeaders(klient, uids, m.sti))
    } catch (e) {
      console.error('Søgning fejlede i', m.sti, e.message)
    } finally { lock.release() }
  }
  fundet.sort((a, b) => new Date(b.dato) - new Date(a.dato))
  return { mails: fundet.slice(0, max) }
}

async function laes(klient, { mappe = 'INBOX', uid }) {
  const lock = await klient.getMailboxLock(mappe)
  try {
    const msg = await klient.fetchOne(String(uid), HEADER_FELTER, { uid: true })
    if (!msg) throw Object.assign(new Error('Mailen findes ikke længere'), { status: 404 })
    const header = tilHeader(msg, mappe)
    const dele = gennemgaaStruktur(msg.bodyStructure)
    const tekst = dele.tekst ? (await hentDel(klient, uid, dele.tekst.part || '1')).toString('utf8') : null
    let html = dele.html ? (await hentDel(klient, uid, dele.html.part || '1')).toString('utf8') : null

    // Indlejrede billeder (cid:) laves om til data-URL'er, så længe de er små
    if (html && dele.inline.length) {
      let brugt = 0
      for (const n of dele.inline) {
        const cid = String(n.id).replace(/^<|>$/g, '')
        if (!html.includes(`cid:${cid}`) || brugt + n.size > MAX_INLINE_BYTES) continue
        try {
          const data = await hentDel(klient, uid, n.part)
          brugt += n.size
          html = html.split(`cid:${cid}`).join(`data:${n.type};base64,${data.toString('base64')}`)
        } catch {}
      }
    }

    if (!header.laest) {
      await klient.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true }).catch(() => {})
      header.laest = true
    }
    return { ...header, tekst, html, vedhaeftninger: dele.vedhaeftninger }
  } finally { lock.release() }
}

async function vedhaeftning(klient, res, { mappe = 'INBOX', uid, part }) {
  const lock = await klient.getMailboxLock(mappe)
  try {
    const { meta, content } = await klient.download(String(uid), String(part), { uid: true })
    const bidder = []
    let str = 0
    for await (const b of content) {
      str += b.length
      if (str > MAX_SVAR_BYTES) throw Object.assign(new Error('Filen er for stor til at hente her – åbn mailen i Roundcube'), { status: 413 })
      bidder.push(b)
    }
    const navn = meta.filename || 'vedhaeftning'
    res.setHeader('Content-Type', meta.contentType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(navn)}`)
    res.setHeader('Cache-Control', 'private, no-store')
    res.status(200).send(Buffer.concat(bidder))
  } finally { lock.release() }
}

async function send(klient, { til, cc, emne, tekst, citatIntro, citatTekst, inReplyTo, references }) {
  const modtagere = String(til || '').split(/[,;]/).map(s => s.trim()).filter(Boolean)
  const ccListe = String(cc || '').split(/[,;]/).map(s => s.trim()).filter(Boolean)
  if (!modtagere.length) throw Object.assign(new Error('Modtager mangler'), { status: 400 })
  if (!String(tekst || '').trim() && !String(citatTekst || '').trim()) throw Object.assign(new Error('Beskeden er tom'), { status: 400 })

  const domæne = (MAIL_USER.split('@')[1] || 'vaniagraphics.dk')
  const messageId = `<${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}@${domæne}>`
  const refs = [...new Set([...(references || []), inReplyTo].filter(Boolean))]
  const opts = {
    from: { name: MAIL_NAVN, address: MAIL_USER },
    to: modtagere, cc: ccListe.length ? ccListe : undefined,
    subject: emne || '',
    text: mailTekst({ tekst, citatIntro, citatTekst }),
    html: mailHtml({ tekst, citatIntro, citatTekst, appUrl: process.env.VITE_APP_URL }),
    messageId,
    inReplyTo: inReplyTo || undefined,
    references: refs.length ? refs.join(' ') : undefined,
    date: new Date()
  }
  const raw = await new MailComposer(opts).compile().build()

  const transport = nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465,
    auth: { user: MAIL_USER, pass: MAIL_PASS }
  })
  await transport.sendMail({ envelope: { from: MAIL_USER, to: [...modtagere, ...ccListe] }, raw })

  // cPanel gemmer ikke selv mails sendt over SMTP – læg en kopi i "Sendt post"
  let sendtMappe = null
  try {
    const m = await mapper(klient)
    sendtMappe = (m.find(x => x.special === '\\Sent') || m.find(x => /(^|\.)sent$/i.test(x.sti)))?.sti || null
    if (sendtMappe) await klient.append(sendtMappe, raw, ['\\Seen'])
  } catch (e) { console.error('Kunne ikke gemme i Sendt post:', e.message) }

  // Markér den mail vi svarede på som besvaret
  if (inReplyTo) {
    try {
      const lock = await klient.getMailboxLock('INBOX')
      try {
        const uids = await klient.search({ header: { 'message-id': inReplyTo } }, { uid: true })
        if (uids?.length) await klient.messageFlagsAdd(uids.join(','), ['\\Answered'], { uid: true })
      } finally { lock.release() }
    } catch {}
  }
  return { ok: true, messageId, sendtMappe }
}

// ---------- Rute ----------

export default async function handler(req, res) {
  const user = await kraevAdminLogin(req, res)
  if (!user) return
  if (!MAIL_USER || !MAIL_PASS || !IMAP_HOST) {
    return res.status(503).json({ error: 'Mail er ikke sat op endnu: MAIL_USER, MAIL_PASS og IMAP_HOST mangler i Vercel', ikkeOpsat: true })
  }

  const action = req.query.action || req.body?.action
  try {
    const svar = await medImap(async klient => {
      switch (action) {
        case 'mapper': return { mapper: await mapper(klient), minAdresse: MAIL_USER.toLowerCase() }
        case 'liste': return { ...await liste(klient, req.query), minAdresse: MAIL_USER.toLowerCase() }
        case 'laes': return await laes(klient, req.query)
        case 'vedhaeftning': await vedhaeftning(klient, res, req.query); return null
        case 'soeg':
          if (req.method !== 'POST') throw Object.assign(new Error('Brug POST'), { status: 405 })
          return { ...await soeg(klient, req.body || {}), minAdresse: MAIL_USER.toLowerCase() }
        case 'send':
          if (req.method !== 'POST') throw Object.assign(new Error('Brug POST'), { status: 405 })
          return await send(klient, req.body || {})
        default: throw Object.assign(new Error('Ukendt handling'), { status: 400 })
      }
    })
    if (svar !== null) res.status(200).json(svar)
  } catch (e) {
    console.error('Mail-fejl:', action, e)
    const tekst = e.authenticationFailed || /auth/i.test(e.responseText || '')
      ? 'Mailserveren afviste login – tjek MAIL_USER og MAIL_PASS i Vercel'
      : e.message
    if (!res.headersSent) res.status(e.status || 500).json({ error: tekst })
  }
}

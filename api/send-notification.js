export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { type, mægler } = req.body
  const KEY = process.env.RESEND_API_KEY
  const FROM = `Vania <${process.env.RESEND_FROM || 'dennis@vaniagraphics.dk'}>`
  const APP_URL = process.env.VITE_APP_URL || 'https://app.vaniagraphics.dk'

  const LOGO = 'https://app.vaniagraphics.dk/vania-logo.png'

  const bg = '#e8e4de'
  const border = '#c8c4be'
  const mono = "'Courier New', monospace"
  const serif = "Georgia, serif"
  const text = '#1a1a1a'
  const muted = '#6b6b6b'

  function base(content) {
    return `<div style="background:${bg};font-family:${mono};max-width:560px;margin:0 auto;padding:32px 20px">
      <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid ${border};margin-bottom:24px">
        <img src="${LOGO}" alt="Vania" style="max-width:200px;width:100%;display:inline-block" />
      </div>
      ${content}
      <div style="border-top:1px solid ${border};margin-top:32px;padding-top:20px;text-align:center">
        <img src="${LOGO}" alt="Vania" style="max-width:120px;width:100%;display:inline-block;opacity:0.5;margin-bottom:8px" /><br>
        <span style="font-size:10px;color:${muted};letter-spacing:.12em;text-transform:uppercase">VANIAGRAPHICS.DK</span>
      </div>
    </div>`
  }

  function infoBlock(rows) {
    const rowsHtml = rows.map(([label, value]) =>
      `<tr>
        <td style="padding:7px 0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${muted};white-space:nowrap;padding-right:20px">${label}</td>
        <td style="padding:7px 0;font-size:13px;color:${text};font-family:Georgia,serif">${value || '—'}</td>
      </tr>`
    ).join('')
    return `<table style="width:100%;border-collapse:collapse;border-top:1px solid ${border};margin:20px 0">${rowsHtml}</table>`
  }

  function heading(label, title) {
    return `<div style="margin-bottom:20px">
      <div style="font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:${muted};margin-bottom:6px">${label}</div>
      <div style="font-family:Georgia,serif;font-size:20px;color:${text};line-height:1.3">${title}</div>
    </div>`
  }

  function btn(href, label) {
    return `<div style="margin:24px 0">
      <a href="${href}" style="display:inline-block;border:1px solid ${text};color:${text};padding:10px 22px;text-decoration:none;font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-family:${mono}">${label} →</a>
    </div>`
  }

  const emails = {
    freelancer_booking: {
      to: mægler?.email,
      subject: `Ny sag tildelt — ${mægler?.adresse}`,
      html: base(`
        ${heading('Opgave', mægler?.adresse)}
        <p style="font-size:13px;color:${text};margin:0 0 4px">Hej ${mægler?.navn || ''},</p>
        <p style="font-size:13px;color:${muted};margin:0 0 20px">Du er booket på en ny sag.</p>
        ${infoBlock([
          ['Adresse', mægler?.adresse],
          ['Dato', mægler?.dato],
          ['Tidspunkt', mægler?.tidspunkt],
          ['Type', mægler?.type || 'Ejendom'],
          ...(mægler?.noter ? [['Noter', mægler.noter]] : [])
        ])}
        <p style="font-size:11px;color:${muted};margin-top:24px">Dennis — VaniaGraphics</p>
      `)
    },
    freelancer_invitation: {
      to: mægler?.email,
      subject: 'Invitation som freelancer — VaniaGraphics',
      html: base(`
        ${heading('Velkommen', 'Du er inviteret som freelancerfotograf')}
        <p style="font-size:13px;color:${text};margin:0 0 4px">Hej ${mægler?.navn || ''},</p>
        <p style="font-size:13px;color:${muted};margin:0 0 20px">Du er tilføjet som freelancerfotograf hos VaniaGraphics.</p>
        ${btn(APP_URL + '/login', 'Opret din adgang')}
        <p style="font-size:11px;color:${muted};margin-top:24px">Dennis — VaniaGraphics</p>
      `)
    },
    ny_booking: {
      to: process.env.RESEND_FROM,
      subject: `Ny booking — ${mægler?.maegler_navn || 'mægler'} — ${mægler?.adresse}`,
      html: base(`
        ${heading('Indgående booking', mægler?.adresse)}
        ${infoBlock([
          ['Dato', mægler?.dato + ' kl. ' + (mægler?.tidspunkt || '—')],
          ['Mægler', (mægler?.maegler_navn || '') + ' · ' + (mægler?.maegler_firma || '—')],
          ['Email', mægler?.maegler_email],
          ['Pakke', mægler?.pakke]
        ])}
        ${btn(APP_URL + '/bookinger', 'Åben bookinger')}
      `)
    },
    booking_bekraeft: {
      to: mægler?.email,
      subject: `Booking bekræftet — ${mægler?.adresse}`,
      html: base(`
        ${heading('Bekræftelse', mægler?.adresse)}
        <p style="font-size:13px;color:${text};margin:0 0 4px">Hej ${mægler?.maegler_navn || ''},</p>
        <p style="font-size:13px;color:${muted};margin:0 0 20px">Din booking er bekræftet af VaniaGraphics.</p>
        ${infoBlock([
          ['Adresse', mægler?.adresse],
          ['Dato', mægler?.dato],
          ['Tidspunkt', 'kl. ' + (mægler?.tidspunkt || '—')],
          ['Pakke', mægler?.pakke],
          ...(mægler?.tillaeg ? [['Tillæg', mægler.tillaeg]] : [])
        ])}
        <p style="font-size:12px;color:${muted};margin-top:16px">Fotografen møder op til aftalt tid. Spørgsmål: dennis@vaniagraphics.dk</p>
        <p style="font-size:11px;color:${muted};margin-top:24px">Dennis — VaniaGraphics</p>
      `)
    },
    booking_afvist: {
      to: mægler?.email,
      subject: `Booking kan desværre ikke bekræftes — ${mægler?.adresse}`,
      html: base(`
        ${heading('Afslag', mægler?.adresse)}
        <p style="font-size:13px;color:${text};margin:0 0 4px">Hej ${mægler?.maegler_navn || ''},</p>
        <p style="font-size:13px;color:${muted};margin:0 0 20px">Vi er desværre ikke i stand til at bekræfte din booking på den ønskede dato.</p>
        ${infoBlock([
          ['Adresse', mægler?.adresse],
          ['Ønsket dato', mægler?.dato]
        ])}
        ${btn(APP_URL + '/book/vaniagraphics', 'Book en ny tid')}
        <p style="font-size:11px;color:${muted};margin-top:24px">Dennis — VaniaGraphics</p>
      `)
    },
    levering: {
      to: mægler?.email,
      subject: `Dine billeder er klar — ${mægler?.adresse}`,
      html: base(`
        ${heading('Levering', mægler?.adresse)}
        <p style="font-size:13px;color:${text};margin:0 0 4px">Hej ${mægler?.navn || ''},</p>
        <p style="font-size:13px;color:${muted};margin:0 0 20px">Billederne fra <span style="font-family:Georgia,serif">${mægler?.adresse}</span> er nu klar til download.</p>
        ${infoBlock([
          ['Adresse', mægler?.adresse],
          ['Fotograferingsdato', mægler?.dato],
          ['Antal billeder', String(mægler?.antal_billeder || 0)]
        ])}
        ${btn(mægler?.galleri_link, 'Se og download billeder')}
        <p style="font-size:12px;color:${muted};margin:0 0 24px">Billederne er tilgængelige i 7 dage — download inden ${new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString('da-DK')}.</p>
        <p style="font-size:11px;color:${muted}">Spørgsmål: dennis@vaniagraphics.dk</p>
      `)
    }
  }

  const emailData = emails[type]
  if (!emailData || !emailData.to) return res.status(400).json({ error: 'Invalid type or missing email' })

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, ...emailData })
    })
    const data = await r.json()
    res.status(200).json({ success: true, id: data.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// Signatur på mails sendt fra FotoFlow (svar, svar alle, videresend).
// Ret oplysningerne her. Tomme felter vises ikke.
// Bygget som tabel med inline styles, så den ser ens ud i Outlook, Gmail og Apple Mail.
import { esc, logoUrl } from './mail-skabelon.js'

export const SIGNATUR = {
  navn: 'Dennis Emig',
  titel: 'Indehaver og fotograf',
  firma: 'Vania Graphics',
  telefon: '+45 4245 5471',
  email: 'dennis@vaniagraphics.dk',
  web: 'vania.dk',
  instagram: '',
}

const SANS = 'Helvetica, Arial, sans-serif'
const TEKST = '#1a1a1a'
const DÆMPET = '#6b6b6b'
const KANT = '#d8d4ce'

const telLink = t => `tel:${String(t).replace(/[^\d+]/g, '')}`

export function signaturTekst(s = SIGNATUR) {
  return [
    s.navn + (s.titel ? `, ${s.titel}` : ''),
    s.firma,
    s.telefon && `Tlf. ${s.telefon}`,
    s.email,
    s.web,
    s.instagram && `Instagram: ${s.instagram}`,
  ].filter(Boolean).join('\n')
}

export function signaturHtml({ appUrl, s = SIGNATUR } = {}) {
  const linje = (indhold) => `<tr><td style="padding:0;font-family:${SANS};font-size:13px;line-height:20px;color:${DÆMPET};">${indhold}</td></tr>`
  const link = (href, tekst) => `<a href="${esc(href)}" style="color:${DÆMPET};text-decoration:none;">${esc(tekst)}</a>`
  const ig = String(s.instagram || '').replace(/^@/, '')
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-collapse:collapse;">
  <tr>
    <td valign="middle" style="padding:0 18px 0 0;border-right:1px solid ${KANT};">
      <img src="${esc(logoUrl(appUrl))}" width="110" height="45" alt="${esc(s.firma)}" style="display:block;width:110px;height:45px;border:0;outline:none;">
    </td>
    <td valign="middle" style="padding:0 0 0 18px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr><td style="padding:0 0 2px 0;font-family:${SANS};font-size:15px;line-height:20px;font-weight:bold;color:${TEKST};">${esc(s.navn)}</td></tr>
        ${s.titel || s.firma ? linje(esc([s.titel, s.firma].filter(Boolean).join(' · '))) : ''}
        ${s.telefon ? linje(link(telLink(s.telefon), s.telefon)) : ''}
        ${s.email ? linje(link(`mailto:${s.email}`, s.email)) : ''}
        ${s.web || ig ? linje([s.web && link(`https://${String(s.web).replace(/^https?:\/\//, '')}`, s.web), ig && link(`https://instagram.com/${ig}`, `@${ig}`)].filter(Boolean).join(' &nbsp;·&nbsp; ')) : ''}
      </table>
    </td>
  </tr>
</table>`
}

// Hele html-delen af en mail: egen tekst, signatur og evt. citeret tidligere mail
export function mailHtml({ tekst, citatIntro, citatTekst, appUrl }) {
  const afsnit = esc(tekst || '').trim().split(/\n{2,}/).map(a =>
    `<p style="margin:0 0 14px 0;">${a.replace(/\n/g, '<br>')}</p>`).join('')
  const citatHtml = citatTekst || citatIntro
    ? `<div style="margin-top:28px;font-size:13px;line-height:19px;color:${DÆMPET};">${esc(citatIntro || '').replace(/\n/g, '<br>')}</div>
<blockquote style="margin:6px 0 0 0;padding:10px 14px;border-left:3px solid ${KANT};color:${DÆMPET};font-size:13px;line-height:19px;">${esc((citatTekst || '').trim()).replace(/\n/g, '<br>')}</blockquote>`
    : ''
  return `<!DOCTYPE html><html lang="da"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;">
<div style="font-family:${SANS};font-size:14px;line-height:21px;color:${TEKST};">
${afsnit}
${signaturHtml({ appUrl })}
${citatHtml}
</div>
</body></html>`
}

// Ren tekst-delen: egen tekst, signatur og citat med "> "
export function mailTekst({ tekst, citatIntro, citatTekst }) {
  const dele = [String(tekst || '').trimEnd(), `-- \n${signaturTekst()}`]
  if (citatIntro || citatTekst) {
    dele.push([citatIntro, ...String(citatTekst || '').trim().split('\n').map(l => `> ${l}`)].filter(Boolean).join('\n'))
  }
  return dele.join('\n\n')
}

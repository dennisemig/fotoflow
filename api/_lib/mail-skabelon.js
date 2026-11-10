// Fælles mail-skabelon til alle FotoFlow-mails.
//
// Mailprogrammer (Outlook, Gmail, Apple Mail m.fl.) fjerner ofte <style>, max-width
// og CSS på <div>. Derfor er alt bygget som tabeller med inline styles, faste
// bredder (600px) og eksplicit width/height på billeder, så logoet aldrig kan
// blive kæmpestort.

export const FARVER = {
  bg: '#e8e4de',
  kort: '#ffffff',
  kant: '#d8d4ce',
  tekst: '#1a1a1a',
  dæmpet: '#6b6b6b',
}

const SANS = "Helvetica, Arial, sans-serif"
const SERIF = "Georgia, 'Times New Roman', serif"

// Logoet (480x196) vises i 160x65, så det står skarpt på retina-skærme.
const LOGO_BREDDE = 160
const LOGO_HØJDE = 65

export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function logoUrl(appUrl) {
  return `${String(appUrl || 'https://app.vaniagraphics.dk').replace(/\/$/, '')}/vania-logo-mail.png`
}

// Hele mailen. content er HTML fra helperne nedenfor.
export function base(content, { logo, preheader = '' } = {}) {
  const { bg, kort, kant, dæmpet } = FARVER
  return `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>VaniaGraphics</title>
</head>
<body style="margin:0;padding:0;background-color:${bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${bg};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" style="background-color:${bg};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr>
          <td align="center" style="padding:0 0 24px 0;">
            <img src="${esc(logo)}" width="${LOGO_BREDDE}" height="${LOGO_HØJDE}" alt="Vania Graphics" style="display:block;width:${LOGO_BREDDE}px;height:${LOGO_HØJDE}px;max-width:${LOGO_BREDDE}px;border:0;outline:none;text-decoration:none;font-family:${SANS};font-size:18px;color:#1a1a1a;">
          </td>
        </tr>
        <tr>
          <td bgcolor="${kort}" style="background-color:${kort};border:1px solid ${kant};padding:36px 36px 32px 36px;font-family:${SANS};">
            ${content}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 12px 0 12px;font-family:${SANS};font-size:11px;line-height:18px;letter-spacing:1px;text-transform:uppercase;color:${dæmpet};">
            Vania Graphics &middot; <a href="https://vaniagraphics.dk" style="color:${dæmpet};text-decoration:none;">vaniagraphics.dk</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

export function heading(label, title) {
  const { tekst, dæmpet } = FARVER
  return `<p style="margin:0 0 8px 0;font-family:${SANS};font-size:11px;line-height:16px;letter-spacing:2px;text-transform:uppercase;color:${dæmpet};">${esc(label)}</p>
<h1 style="margin:0 0 24px 0;font-family:${SERIF};font-size:26px;line-height:32px;font-weight:normal;color:${tekst};">${esc(title)}</h1>`
}

// Brødtekst. html=true betyder at teksten allerede er HTML (fx med <strong>).
export function p(text, { muted = false, small = false, html = false } = {}) {
  const { tekst, dæmpet } = FARVER
  const size = small ? '13px' : '15px'
  const lh = small ? '20px' : '23px'
  return `<p style="margin:0 0 14px 0;font-family:${SANS};font-size:${size};line-height:${lh};color:${muted ? dæmpet : tekst};">${html ? text : esc(text)}</p>`
}

export function infoBlock(rows) {
  const { tekst, dæmpet, kant } = FARVER
  const rowsHtml = rows.map(([label, value]) => `
    <tr>
      <td valign="top" width="42%" style="padding:11px 12px 11px 0;border-bottom:1px solid ${kant};font-family:${SANS};font-size:11px;line-height:18px;letter-spacing:1px;text-transform:uppercase;color:${dæmpet};">${esc(label)}</td>
      <td valign="top" style="padding:11px 0;border-bottom:1px solid ${kant};font-family:${SANS};font-size:15px;line-height:20px;color:${tekst};">${esc(value || '—')}</td>
    </tr>`).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 24px 0;border-top:1px solid ${kant};">${rowsHtml}
</table>`
}

// "Bulletproof" knap: en tabelcelle med baggrundsfarve, så den også ser ud som en
// knap i Outlook.
export function btn(href, label) {
  const { tekst } = FARVER
  if (!href) return ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;">
  <tr>
    <td align="center" bgcolor="${tekst}" style="background-color:${tekst};">
      <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:13px;line-height:16px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${esc(label)}&nbsp;&rarr;</a>
    </td>
  </tr>
</table>`
}

// Fremhævet boks (advarsel/bemærkning).
export function note(label, text, { mørk = false } = {}) {
  const bg = mørk ? '#1a1a1a' : '#fff8e1'
  const kant = mørk ? '#1a1a1a' : '#f0d27a'
  const farve = mørk ? '#e8e4de' : FARVER.tekst
  const labelFarve = mørk ? '#e8e4de' : '#856404'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
  <tr>
    <td bgcolor="${bg}" style="background-color:${bg};border:1px solid ${kant};padding:14px 18px;font-family:${SANS};">
      ${label ? `<p style="margin:0 0 ${text ? '6px' : '0'} 0;font-size:11px;line-height:16px;letter-spacing:1.5px;text-transform:uppercase;color:${labelFarve};">${esc(label)}</p>` : ''}
      ${text ? `<p style="margin:0;font-size:14px;line-height:21px;color:${farve};">${esc(text)}</p>` : ''}
    </td>
  </tr>
</table>`
}

export function signatur() {
  return `<p style="margin:24px 0 0 0;font-family:${SANS};font-size:14px;line-height:20px;color:${FARVER.tekst};">Venlig hilsen<br>Dennis &middot; Vania Graphics</p>`
}

export function kontakt() {
  return p(`Spørgsmål? Skriv til <a href="mailto:dennis@vaniagraphics.dk" style="color:${FARVER.tekst};">dennis@vaniagraphics.dk</a>`, { muted: true, small: true, html: true })
}

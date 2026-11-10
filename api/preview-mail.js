import { byggMails, EKSEMPEL } from './_lib/mails.js'

// Forhåndsvisning af mails med eksempeldata (sender intet).
//   /api/preview-mail                  -> liste over mailtyper
//   /api/preview-mail?type=levering    -> selve mailen
export default function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const appUrl = `${proto}://${req.headers.host}`
  const mails = byggMails(EKSEMPEL, { appUrl, ownerEmail: 'dennis@vaniagraphics.dk' })
  const type = req.query?.type

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')

  if (type && mails[type]) return res.status(200).send(mails[type].html)

  const links = Object.entries(mails)
    .map(([t, m]) => `<li style="margin:8px 0"><a href="?type=${t}">${t}</a> <span style="color:#6b6b6b">— ${m.subject}</span></li>`)
    .join('')
  res.status(type ? 404 : 200).send(`<!DOCTYPE html><meta charset="utf-8"><title>Mail-forhåndsvisning</title>
<body style="font-family:Helvetica,Arial,sans-serif;padding:32px;background:#e8e4de;color:#1a1a1a">
<h1 style="font-weight:normal;font-family:Georgia,serif">Mail-forhåndsvisning</h1>
${type ? `<p>Ukendt type: ${String(type).replace(/[<>&"]/g, '')}</p>` : ''}
<ul>${links}</ul></body>`)
}

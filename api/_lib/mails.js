import { base, heading, p, infoBlock, btn, note, signatur, kontakt, esc, logoUrl } from './mail-skabelon.js'

// Bygger alle mailtyper ud fra de data, som appen sender (feltet "mægler").
// Bruges både af /api/send-notification og af /api/preview-mail.
export function byggMails(m = {}, { appUrl, logo, ownerEmail } = {}) {
  const APP_URL = appUrl || 'https://app.vaniagraphics.dk'
  const LOGO = logo || logoUrl(APP_URL)
  const wrap = (content, preheader) => base(content, { logo: LOGO, preheader })
  const hej = navn => p(`Hej${navn ? ' ' + navn : ''},`)

  const udløb = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('da-DK')

  return {
    freelancer_booking: {
      to: m.email,
      subject: `Ny sag tildelt — ${m.adresse}`,
      html: wrap(`
        ${heading('Ny opgave', m.adresse)}
        ${hej(m.navn)}
        ${p('Du er booket på en ny sag.', { muted: true })}
        ${infoBlock([
          ['Adresse', m.adresse],
          ['Dato', m.dato],
          ['Tidspunkt', m.tidspunkt],
          ['Type', m.type || 'Ejendom'],
          ...(m.noter ? [['Noter', m.noter]] : [])
        ])}
        ${signatur()}
      `, `Du er booket på ${m.adresse || 'en ny sag'}`)
    },
    freelancer_invitation: {
      to: m.email,
      subject: 'Invitation som freelancer — VaniaGraphics',
      html: wrap(`
        ${heading('Velkommen', 'Du er inviteret som freelancefotograf')}
        ${hej(m.navn)}
        ${p('Du er tilføjet som freelancefotograf hos Vania Graphics. Klik nedenfor for at oprette din adgang.', { muted: true })}
        ${btn(APP_URL + '/login', 'Opret din adgang')}
        ${signatur()}
      `, 'Opret din adgang til FotoFlow')
    },
    ny_booking: {
      to: ownerEmail,
      subject: m.kontakt_selger
        ? `⚠️ Ring sælger — ${m.adresse}`
        : `Ny booking — ${m.maegler_navn || 'mægler'} — ${m.adresse}`,
      html: wrap(`
        ${m.kontakt_selger ? note('Afventer tidspunkt — kontakt sælger', '', { mørk: true }) : ''}
        ${heading('Indgående booking', m.adresse)}
        ${infoBlock([
          ...(m.kontakt_selger ? [
            ['Sælger', m.selger_navn],
            ['Sælger tlf', m.selger_telefon],
            ['Dato', '— (vi kontakter sælger)'],
          ] : [
            ['Dato', `${m.dato || '—'} kl. ${m.tidspunkt || '—'}`],
          ]),
          ['Mægler', `${m.maegler_navn || ''} · ${m.maegler_firma || '—'}`],
          ['Email', m.maegler_email],
          ['Pakke', m.pakke]
        ])}
        ${btn(APP_URL + '/bookinger', 'Åbn bookinger')}
      `, `Ny booking: ${m.adresse || ''}`)
    },
    booking_afventer_selger: {
      to: m.email,
      subject: `Din booking afventer svar fra sælger — ${m.adresse}`,
      html: wrap(`
        ${heading('Booking på hold', m.adresse)}
        ${hej(m.maegler_navn)}
        ${p('Vi afventer i øjeblikket svar fra sælger for at aftale tidspunkt. Vi vender tilbage, så snart vi har en dato.', { muted: true })}
        ${m.bemærkning ? note('Bemærkning', m.bemærkning) : ''}
        ${infoBlock([['Adresse', m.adresse]])}
        ${kontakt()}
        ${signatur()}
      `, 'Vi afventer svar fra sælger')
    },
    booking_bekraeft: {
      to: m.email,
      subject: `Booking bekræftet — ${m.adresse}`,
      html: wrap(`
        ${heading('Booking bekræftet', m.adresse)}
        ${hej(m.maegler_navn)}
        ${p('Din booking er bekræftet af Vania Graphics.', { muted: true })}
        ${infoBlock([
          ['Adresse', m.adresse],
          ['Dato', m.dato],
          ['Tidspunkt', 'kl. ' + (m.tidspunkt || '—')],
          ['Pakke', m.pakke],
          ...(m.tillaeg ? [['Tillæg', m.tillaeg]] : [])
        ])}
        ${p('Fotografen møder op til aftalt tid.', { muted: true, small: true })}
        ${kontakt()}
        ${signatur()}
      `, `Bekræftet: ${m.dato || ''} kl. ${m.tidspunkt || ''}`)
    },
    booking_afvist: {
      to: m.email,
      subject: `Booking kan desværre ikke bekræftes — ${m.adresse}`,
      html: wrap(`
        ${heading('Booking ikke bekræftet', m.adresse)}
        ${hej(m.maegler_navn)}
        ${p('Vi er desværre ikke i stand til at bekræfte din booking på den ønskede dato.', { muted: true })}
        ${infoBlock([
          ['Adresse', m.adresse],
          ['Ønsket dato', m.dato]
        ])}
        ${btn(APP_URL + '/book/vaniagraphics', 'Book en ny tid')}
        ${signatur()}
      `, 'Book gerne en ny tid')
    },
    levering: {
      to: m.email,
      subject: `Dine billeder er klar — ${m.adresse}`,
      html: wrap(`
        ${heading('Levering', m.adresse)}
        ${hej(m.navn)}
        ${p(`Billederne fra <strong>${esc(m.adresse)}</strong> er nu klar til download.`, { html: true })}
        ${infoBlock([
          ['Adresse', m.adresse],
          ['Fotograferingsdato', m.dato],
          ['Antal billeder', String(m.antal_billeder || 0)]
        ])}
        ${btn(m.galleri_link, 'Se og download billeder')}
        ${p(`Billederne er tilgængelige i 7 dage. Download dem senest ${udløb}.`, { muted: true, small: true })}
        ${kontakt()}
        ${signatur()}
      `, `${m.antal_billeder || ''} billeder fra ${m.adresse || ''} er klar`.trim())
    }
  }
}

// Eksempeldata til forhåndsvisning.
export const EKSEMPEL = {
  email: 'test@example.com',
  navn: 'Nybolig Ballerup / Smørum',
  maegler_navn: 'Mette Jensen',
  maegler_email: 'mette@example.com',
  maegler_firma: 'Nybolig Ballerup / Smørum',
  adresse: 'Gl. Rådhusvej 18A',
  dato: '10.9.2026',
  tidspunkt: '10:00',
  type: 'Ejendom',
  pakke: 'Standard',
  tillaeg: 'Drone, plantegning',
  antal_billeder: 24,
  galleri_link: 'https://app.vaniagraphics.dk/levering/eksempel',
  selger_navn: 'Peter Hansen',
  selger_telefon: '12 34 56 78',
  bemærkning: 'Sælger er bortrejst til og med fredag.',
  noter: 'Nøgle hos naboen i nr. 20.',
}

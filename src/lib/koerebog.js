// Kørebog til PDF og Excel: én linje pr. tur (fra → til), som en klassisk kørebog

const datoTekst = d => new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
const kmTekst = n => `${n.toLocaleString('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
const krTekst = n => `${n.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr.`
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// Ture for én dag. rækker er dagens sager (fra Koersel) i køre-rækkefølge.
// Med rute: hjem → sag 1 → sag 2 → … → hjem. Uden: hjem → sag → hjem for hver sag.
export function dagensTure(dato, rækker, rute) {
  const hjem = { navn: 'Hjem' }
  const stop = s => ({ navn: s.kunde?.navn || 'Fotoopgave', adresse: s.adresse })
  const formaal = s => `Fotografering${s.kunde?.navn ? ' – ' + s.kunde.navn : ''}`
  const ture = []
  const iRute = rute && !rute.fejl ? rækker.filter((s, i) => rute.med[i] && s.km != null) : []
  if (iRute.length > 0) {
    iRute.forEach((s, k) => {
      ture.push({ dato, fra: k === 0 ? hjem : stop(iRute[k - 1]), til: stop(s), formaal: formaal(s), km: rute.ben[k] })
    })
    const sidste = iRute[iRute.length - 1]
    ture.push({ dato, fra: stop(sidste), til: hjem, formaal: 'Hjemkørsel', km: rute.ben[iRute.length] })
  }
  rækker.filter(s => !iRute.includes(s) && s.km != null).forEach(s => {
    const km = Math.round(s.km / 2 * 10) / 10
    ture.push({ dato, fra: hjem, til: stop(s), formaal: formaal(s), km, separat: s.separat })
    ture.push({ dato, fra: stop(s), til: hjem, formaal: 'Hjemkørsel', km, separat: s.separat })
  })
  return ture
}

function sted(p, startadresse) {
  return p.navn === 'Hjem' ? { navn: 'Hjem', adresse: startadresse || '' } : p
}

export function koerebogPdf({ ture, fra, til, profil, sats }) {
  const totalKm = Math.round(ture.reduce((a, t) => a + t.km, 0) * 10) / 10
  const total = totalKm * sats
  const adresse = profil?.startadresse || ''
  const linjer = ture.map(t => {
    const f = sted(t.fra, adresse), ti = sted(t.til, adresse)
    return `<tr>
      <td>${esc(datoTekst(t.dato))}</td>
      <td><b>${esc(f.navn)}</b><br>${esc(f.adresse)}</td>
      <td><b>${esc(ti.navn)}</b><br>${esc(ti.adresse)}</td>
      <td>Erhverv<br><span class="m">${esc(t.formaal)}${t.separat ? ' *' : ''}</span></td>
      <td class="r">${kmTekst(t.km)}</td>
      <td class="r">${krTekst(sats)}</td>
      <td class="r">${krTekst(t.km * sats)}</td>
    </tr>`
  }).join('')
  const html = `<!doctype html><html lang="da"><head><meta charset="utf-8"><title>Kørebog ${esc(fra)} – ${esc(til)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #222; font-size: 11px; margin: 0; }
  h1 { font-size: 26px; font-weight: 500; margin: 0 0 18px; }
  h1 span { font-size: 14px; color: #777; font-weight: 400; }
  h2 { font-size: 15px; font-weight: 600; margin: 22px 0 6px; }
  .info { display: grid; grid-template-columns: 90px 1fr; gap: 2px 12px; border-top: 1px solid #ccc; padding-top: 10px; }
  .info div:nth-child(odd) { color: #555; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #e6e6e6; text-align: left; padding: 5px 6px; font-weight: 600; }
  td { padding: 6px; border-bottom: 1px solid #e3e3e3; vertical-align: top; line-height: 1.35; }
  tr { page-break-inside: avoid; }
  .r { text-align: right; white-space: nowrap; }
  .m { color: #666; }
  .total td { font-weight: 700; border-bottom: none; }
  .note { margin-top: 10px; color: #666; }
</style></head><body>
<h1>Kørebog <span>for d. ${esc(datoTekst(fra))} til d. ${esc(datoTekst(til))}</span></h1>
<div class="info">
  <div>Udskrevet:</div><div>${esc(new Date().toLocaleString('da-DK', { dateStyle: 'full', timeStyle: 'short' }))}</div>
  <div>Navn:</div><div>${esc(profil?.full_name || '')}</div>
  <div>Adresse:</div><div>${esc(adresse)}</div>
</div>
<h2>Opsummering</h2>
<table>
  <tr><th>Type</th><th class="r">Antal ture</th><th class="r">Afstand</th><th class="r">Sats</th><th class="r">Godtgørelse</th></tr>
  <tr><td>Erhverv</td><td class="r">${ture.length}</td><td class="r">${kmTekst(totalKm)}</td><td class="r">${krTekst(sats)}</td><td class="r">${krTekst(total)}</td></tr>
  <tr class="total"><td>Total</td><td></td><td class="r">${kmTekst(totalKm)}</td><td></td><td class="r">${krTekst(total)}</td></tr>
</table>
<h2>Ture i perioden</h2>
<table>
  <tr><th>Dato</th><th>Fra</th><th>Til</th><th>Formål</th><th class="r">Afstand</th><th class="r">Sats</th><th class="r">Godtgørelse</th></tr>
  ${linjer}
  <tr class="total"><td colspan="4">Total</td><td class="r">${kmTekst(totalKm)}</td><td></td><td class="r">${krTekst(total)}</td></tr>
</table>
${ture.some(t => t.separat) ? '<div class="note">* Kunne ikke indgå i dagens samlede rute og er regnet som separat tur hjemmefra.</div>' : ''}
<div class="note">Afstande er beregnet som korteste køreafstand (OpenStreetMap). Dage med flere opgaver er kørt som én rute i rækkefølge efter tidspunkt.</div>
<script>window.onload = () => setTimeout(() => window.print(), 300)</script>
</body></html>`
  const w = window.open('', '_blank')
  if (!w) { alert('Tillad pop-up vinduer for at eksportere PDF'); return }
  w.document.write(html)
  w.document.close()
}

// CSV til dansk Excel: semikolon, decimalkomma og BOM så æøå vises rigtigt
export function koerebogCsv({ ture, fra, til, profil, sats }) {
  const tal = (n, d = 1) => n.toFixed(d).replace('.', ',')
  const felt = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const adresse = profil?.startadresse || ''
  const totalKm = Math.round(ture.reduce((a, t) => a + t.km, 0) * 10) / 10
  const linjer = [
    ['Kørebog', `${datoTekst(fra)} – ${datoTekst(til)}`],
    ['Navn', profil?.full_name || ''],
    ['Adresse', adresse],
    [],
    ['Opsummering', 'Antal ture', 'Afstand (km)', 'Sats (kr/km)', 'Godtgørelse (kr)'],
    ['Erhverv', ture.length, tal(totalKm), tal(sats, 2), tal(totalKm * sats, 2)],
    [],
    ['Dato', 'Fra', 'Fra adresse', 'Til', 'Til adresse', 'Formål', 'Afstand (km)', 'Sats (kr/km)', 'Godtgørelse (kr)'],
    ...ture.map(t => {
      const f = sted(t.fra, adresse), ti = sted(t.til, adresse)
      return [datoTekst(t.dato), f.navn, f.adresse, ti.navn, ti.adresse, t.formaal + (t.separat ? ' *' : ''), tal(t.km), tal(sats, 2), tal(t.km * sats, 2)]
    }),
    ['Total', '', '', '', '', '', tal(totalKm), '', tal(totalKm * sats, 2)],
  ]
  if (ture.some(t => t.separat)) linjer.push([], ['* Kunne ikke indgå i dagens samlede rute og er regnet som separat tur hjemmefra'])
  const csv = '﻿' + linjer.map(l => l.map(felt).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `koerebog_${fra}_${til}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

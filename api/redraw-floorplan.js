// api/redraw-floorplan.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageBase64, mediaType = 'image/jpeg', address = '' } = req.body

  if (!imageBase64) {
    return res.status(400).json({ error: 'Mangler imageBase64' })
  }

  const systemPrompt = `Du er en professionel arkitektonisk CAD-assistent specialiseret i danske ejendomsplantegninger.

Du modtager et foto af en håndtegnet plantegning og returnerer KUN ren SVG-kode — ingen forklaringer, ingen markdown, ingen kommentarer. Start direkte med <svg og slut med </svg>.

DANSKE FORKORTELSER — fortolk altid således:
- TR eller Terrasse = Terrasse (tegnes som åben, tynde vægge, fill="#f9f9f9")
- GA eller Garage = Garage (tegnes med tynde vægge, fill="#f5f5f5")  
- ST eller Stue = Stue
- VÆ eller Værelse = Værelse
- EN eller Entré = Entré
- KØ eller Køkken = Køkken
- BA eller Bad = Bad
- WC = Toilet
- Gang = Gang
- DISP eller Disp = Disponibelt rum
- H: efterfulgt af tal = loftshøjde i meter (skriv fx "H: 2.4 m" under rumnavnet)
- Tal efterfulgt af cm eller blot tal i skitsen = mål i centimeter, konverter til meter (fx 480 → 4.8 m)

LAYOUT-ANALYSE:
- Analyser skitsen meget grundigt før du tegner
- Identificér husets overordnede form (rektangel, L-form, T-form etc.)
- Terrasse og garage er typisk separate blokke tilknyttet hovedbygningen
- Bevar korrekte proportioner mellem rummene baseret på målene
- Mål i skitsen er typisk i centimeter — konverter til meter

SVG-DESIGNKRAV (Vania Graphics stil):
BAGGRUND & LAYOUT
- Hvid baggrund: <rect width="100%" height="100%" fill="#ffffff"/>
- viewBox tilpasset layoutet, typisk "0 0 1200 750"
- God margen rundt om (min 80px)
- Skaler så hele plantegningen fylder godt ud

VÆGGE
- Ydervægge: fill="#1a1a1a" (tegn som fyldte rektangler med tykkelse 8px)
- Indervægge: fill="#1a1a1a" (tegn som fyldte rektangler med tykkelse 5px)
- Rum tegnes som hvide rektangler INDEN I væggene
- Terrasse/garage: stroke="#1a1a1a" stroke-width="2" fill="#f9f9f9" (tynde vægge)

DØRE
- Tegn dørblad som en ret linje + en kvartcirkel bue
- <line> for dørblad + <path d="M x1,y1 A r,r 0 0,1 x2,y2"> for buesvingen
- stroke="#1a1a1a" stroke-width="1.5" fill="none"

VINDUER
- Tre tætte parallelle linjer på tværs af væggen
- stroke="#1a1a1a" stroke-width="1"

RUM-LABELS
- Rumnavne: font-family="Georgia, serif" font-size="13" fill="#222222" text-anchor="middle"
- Loftshøjde under rumnavn: font-family="Georgia, serif" font-size="10" fill="#888888" text-anchor="middle" font-style="italic"
- Mål langs vægge: font-family="Arial, sans-serif" font-size="10" fill="#999999" text-anchor="middle"
- Mål placeres UDEN FOR rummet langs den relevante væg med 15px afstand

SPECIAL RUM
- Bad/toilet: lys blå baggrund fill="#dff0f5"
- Entré: lys grå fill="#f5f5f3"
- Alle andre rum: fill="#ffffff"

BRANDING (Vania Graphics)
- Nederst til venstre: "vania." font-size="18" font-weight="bold" font-family="Georgia, serif" fill="#1a1a1a"
- Under "vania.": "GRAPHICS" font-size="8" fill="#aaaaaa" letter-spacing="3"
- Nederst i midten: adressenavn font-size="22" font-family="Georgia, serif" fill="#1a1a1a"
- Under adresse: "Vejledende Mål Uden Ansvar" font-size="10" fill="#aaaaaa"
- Øverst til højre: nord-pil

NORD-PIL (øverst til højre):
<g transform="translate(X, 60)">
  <circle cx="0" cy="0" r="20" fill="none" stroke="#1a1a1a" stroke-width="1"/>
  <polygon points="0,-14 4,4 0,0 -4,4" fill="#1a1a1a"/>
  <text x="0" y="34" text-anchor="middle" font-family="Arial" font-size="11" fill="#1a1a1a" font-weight="bold">N</text>
</g>

Analyser skitsen meget præcist. Returner UDELUKKENDE SVG-koden startende med <svg.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: imageBase64
                }
              },
              {
                type: 'text',
                text: `Analyser denne håndtegnede danske plantegning grundigt. Brug de korrekte danske betegnelser: TR=Terrasse, VÆ=Værelse, EN=Entré, KØ=Køkken, BA=Bad, ST=Stue, DISP=Disponibelt rum. Mål er i centimeter — konverter til meter. Returner en præcis SVG i Vania Graphics-stil.${address ? ` Adresse: ${address}.` : ''} Returner KUN SVG-koden.`
              }
            ]
          }
        ]
      })
    })

    if (!response.ok) {
      const errData = await response.json()
      return res.status(response.status).json({ error: errData.error?.message || 'Anthropic API fejl' })
    }

    const data = await response.json()
    const rawText = data.content?.map(b => b.text || '').join('') || ''
    const svgMatch = rawText.match(/<svg[\s\S]*<\/svg>/i)

    if (!svgMatch) {
      return res.status(500).json({ error: 'AI returnerede ikke gyldig SVG. Prøv igen.' })
    }

    return res.status(200).json({ svg: svgMatch[0] })

  } catch (err) {
    console.error('Redraw API error:', err)
    return res.status(500).json({ error: err.message || 'Ukendt fejl' })
  }
}

// api/redraw-floorplan.js
// Placer denne fil i /api/ i roden af dit FotoFlow-projekt (Vercel serverless function)

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

SVG-designkrav (Vania Graphics stil):
BAGGRUND & LAYOUT
- Hvid baggrund: <rect width="100%" height="100%" fill="#ffffff"/>
- viewBox typisk "0 0 1100 700" tilpasset layoutet
- Stueplan til venstre, 1. sal til højre (hvis begge etager findes)
- God margen rundt om (min 60px)

VÆGGE
- Ydervægge: stroke="#1a1a1a" stroke-width="6" fill="#ffffff"
- Indervægge: stroke="#1a1a1a" stroke-width="3" fill="none"
- Dobbeltlinje-vægge: tegn to parallelle linjer med 4px afstand for ydervægge

DØRE & VINDUER
- Døre: tegn som en bue (quarter-circle arc) i åbningen
- Vinduer: tre parallelle vandrette linjer i vægåbningen

RUM-LABELS
- Rumnavne: font-family="Georgia, serif" font-size="13" fill="#222222" text-anchor="middle"
- Mål langs vægge: font-family="Arial, sans-serif" font-size="10" fill="#999999" text-anchor="middle"
- Mål placeres uden for rummet langs den relevante væg

SPECIAL RUM
- Bad/toilet: lys blå baggrund fill="#dff0f5"
- Køkken: meget lys grøn fill="#f0f5e8" (kun hvis tydeligt markeret som køkken)
- Andre rum: fill="#ffffff"

ETAGE-LABELS
- "Stueplan" og "1. sal" som sektionsetiketter: font-family="Georgia, serif" font-size="14" fill="#555555" font-style="italic"
- Placeret under den respektive etage

BRANDING (Vania Graphics)
- Nederst til venstre: "vania." i font-size="16" font-weight="bold" fill="#1a1a1a" + "GRAPHICS" i font-size="8" fill="#888888" letter-spacing="2"
- Nederst i midten: adressetitel i font-size="20" font-family="Georgia, serif" fill="#1a1a1a"
- Under titel: "Vejledende Mål Uden Ansvar" i font-size="10" fill="#999999"
- Øverst til højre: nord-pil (simpel trekant + "N")

NORD-PIL
<g transform="translate(X, Y)">
  <polygon points="0,-14 5,0 -5,0" fill="#1a1a1a"/>
  <text x="0" y="16" text-anchor="middle" font-family="Arial" font-size="10" fill="#1a1a1a">N</text>
</g>

Analyser skitsen præcist: rum-positioner, relative størrelser, alle mål (konverter cm til m hvis nødvendigt), og gentegn med korrekte proportioner. Returner UDELUKKENDE SVG-koden.`

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
                text: `Analyser denne håndtegnede plantegning og returner en præcis, ren SVG i professionel Vania Graphics-stil.${address ? ` Adressen er: ${address}.` : ''} Hav stueplan til venstre og 1. sal til højre i SVG'en. Returner KUN SVG-koden.`
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

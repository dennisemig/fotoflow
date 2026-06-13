// api/redraw-floorplan.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageBase64, mediaType = 'image/jpeg', address = '' } = req.body

  if (!imageBase64) {
    return res.status(400).json({ error: 'Mangler imageBase64' })
  }

  // ── TRIN 1: Analyser skitsen til JSON ──────────────────────────────────────
  const analysePrompt = `Du er en arkitektonisk assistent der analyserer håndtegnede danske plantegninger.

DANSKE FORKORTELSER:
- TR = Terrasse
- GA = Garage  
- ST = Stue
- VÆ = Værelse
- EN = Entré
- KØ = Køkken
- BA = Bad
- WC = Toilet
- DISP = Disponibelt rum
- Gang = Gang
- S = Skab (lille firkant langs væg)
- H: = loftshøjde i meter
- Alle tal i skitsen er centimeter → konverter til meter (fx 480 → 4.8)

Analyser billedet meget grundigt og returner KUN et JSON-objekt (ingen markdown, ingen forklaringer):

{
  "building": {
    "type": "enkeltplan|toetager",
    "floors": ["stueplan"] eller ["stueplan", "1. sal"]
  },
  "rooms": [
    {
      "id": "room_1",
      "name": "Stue",
      "floor": "stueplan",
      "type": "living|bedroom|kitchen|bathroom|hallway|utility|terrace|garage|other",
      "x_cm": 0,
      "y_cm": 0,
      "width_cm": 800,
      "height_cm": 480,
      "ceiling_height_m": 2.4,
      "doors": [
        {
          "wall": "top|bottom|left|right",
          "position_cm": 150,
          "width_cm": 90,
          "swing": "inward|outward",
          "swing_direction": "left|right"
        }
      ],
      "windows": [
        {
          "wall": "top|bottom|left|right",
          "position_cm": 200,
          "width_cm": 120
        }
      ],
      "cabinets": [
        {
          "wall": "top|bottom|left|right",
          "position_cm": 50,
          "width_cm": 60,
          "depth_cm": 60
        }
      ],
      "fixtures": ["toilet", "sink", "bathtub", "shower", "stove", "refrigerator", "dishwasher", "washing_machine"]
    }
  ],
  "north_direction": "up|down|left|right"
}

Vær meget præcis med positioner. x_cm og y_cm er rummets øverste venstre hjørne relativt til hele bygningens øverste venstre hjørne. Terrasse og garage er separate blokke — giv dem negative koordinater hvis de sidder over/til venstre for hovedbygningen.`

  let floorplanJSON = null

  try {
    const analyseRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 }
            },
            {
              type: 'text',
              text: `Analyser denne håndtegnede plantegning for ${address || 'ejendommen'} og returner KUN JSON som beskrevet. Alle mål er i centimeter.`
            }
          ]
        }],
        system: analysePrompt
      })
    })

    const analyseData = await analyseRes.json()
    const rawText = analyseData.content?.map(b => b.text || '').join('') || ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/i)
    if (!jsonMatch) throw new Error('Ingen JSON fra analyse-trin')
    floorplanJSON = JSON.parse(jsonMatch[0])

  } catch (err) {
    return res.status(500).json({ error: 'Analyse fejlede: ' + err.message })
  }

  // ── TRIN 2: Generer SVG fra JSON ───────────────────────────────────────────
  const svgPrompt = `Du er en SVG-tegner der laver professionelle danske ejendomsplantegninger i Vania Graphics-stilen.

Du modtager et JSON-objekt med præcise rum-data og skal returnere KUN ren SVG-kode. Ingen forklaringer, ingen markdown.

SKALA: 1 cm i virkeligheden = 1 px i SVG (SVG-koordinater er direkte i cm-værdier fra JSON)
OFFSET: Læg 100px til alle koordinater som margen. Juster viewBox så alt passer inden for.

VANIA GRAPHICS DESIGNREGLER:

BAGGRUND:
<rect width="100%" height="100%" fill="#ffffff"/>

VÆGGE — tegn rum som fyldte rektangler der overlapper (vægtykkelse skabes automatisk):
- Ydervæg rum: stroke="#1a1a1a" stroke-width="8" fill="[rumsfarve]"
- Indervæg rum: stroke="#1a1a1a" stroke-width="4" fill="[rumsfarve]"
- Terrasse/garage: stroke="#1a1a1a" stroke-width="2" fill="#f8f8f8" stroke-dasharray="none"

RUMFARVER:
- bathroom: fill="#dff0f5"
- kitchen: fill="#f0f5e8"  
- hallway/entré: fill="#f5f5f3"
- terrace/garage: fill="#f8f8f8"
- alle andre: fill="#ffffff"

VINDUER — erstat et stykke af væglinjen med tre tætte parallelle linjer:
For en vindue på top-væg ved position X med bredde W:
<line x1="X" y1="RoomY" x2="X+W" y2="RoomY" stroke="#ffffff" stroke-width="10"/>
<line x1="X" y1="RoomY-2" x2="X+W" y2="RoomY-2" stroke="#1a1a1a" stroke-width="1"/>
<line x1="X" y1="RoomY" x2="X+W" y2="RoomY" stroke="#1a1a1a" stroke-width="1"/>
<line x1="X" y1="RoomY+2" x2="X+W" y2="RoomY+2" stroke="#1a1a1a" stroke-width="1"/>

DØRE — dørblad + buesvingning:
For dør på top-væg, swing right:
<line x1="DoorX" y1="RoomY" x2="DoorX" y2="RoomY-DoorW" stroke="#1a1a1a" stroke-width="1.5"/>
<path d="M DoorX,RoomY A DoorW,DoorW 0 0,0 DoorX+DoorW,RoomY" fill="none" stroke="#1a1a1a" stroke-width="1"/>
Åbning i væggen: tegn en hvid rect der dækker væglinjen i dørbredden

SKABE — lille fyldt rektangel langs væg:
<rect x="X" y="Y" width="W" height="D" fill="#e8e8e8" stroke="#1a1a1a" stroke-width="1"/>

INVENTAR (tegn simple symboler):
- toilet: oval + cisterne-rektangel
- sink: lille rundet rektangel
- bathtub: rektangel med oval indeni
- shower: kvadrat med kryds
- stove: rektangel med 4 cirkler
- refrigerator: rektangel med lille cirkel

RUM-LABELS (centreret i rummet):
<text x="CX" y="CY-8" text-anchor="middle" font-family="Georgia, serif" font-size="13" fill="#222222">Rumnavn</text>
Hvis loftshøjde: <text x="CX" y="CY+10" text-anchor="middle" font-family="Georgia, serif" font-size="10" fill="#888888" font-style="italic">H: 2.4 m</text>

MÅL langs vægge (udenfor rummet, 20px fra vægkant):
<text> med font-family="Arial, sans-serif" font-size="10" fill="#999999"
Tilføj mållinje: <line stroke="#cccccc" stroke-width="0.5"/> med pile

BRANDING (placeret i bunden, under alle rum):
Venstre: 
<text font-family="Georgia, serif" font-size="18" font-weight="bold" fill="#1a1a1a">vania.</text>
<text font-family="Arial, sans-serif" font-size="8" fill="#aaaaaa" letter-spacing="3">GRAPHICS</text>

Midten:
<text font-family="Georgia, serif" font-size="22" fill="#1a1a1a">[ADRESSE]</text>
<text font-family="Arial, sans-serif" font-size="10" fill="#aaaaaa">Vejledende Mål Uden Ansvar</text>

Højre: Nord-pil med cirkel:
<g>
  <circle r="18" fill="none" stroke="#1a1a1a" stroke-width="1.2"/>
  <polygon points="0,-13 3.5,4 0,0 -3.5,4" fill="#1a1a1a"/>
  <text y="32" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" fill="#1a1a1a">N</text>
</g>

Returner UDELUKKENDE SVG startende med <svg viewBox="..." og sluttende med </svg>.`

  try {
    const svgRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: `Generer en præcis Vania Graphics SVG-plantegning fra dette JSON. Adresse: "${address || ''}". Returner KUN SVG-koden.\n\nJSON:\n${JSON.stringify(floorplanJSON, null, 2)}`
        }],
        system: svgPrompt
      })
    })

    const svgData = await svgRes.json()
    const rawSvg = svgData.content?.map(b => b.text || '').join('') || ''
    const svgMatch = rawSvg.match(/<svg[\s\S]*<\/svg>/i)

    if (!svgMatch) {
      return res.status(500).json({ error: 'SVG-generering fejlede. Prøv igen.' })
    }

    return res.status(200).json({ svg: svgMatch[0], debug: floorplanJSON })

  } catch (err) {
    return res.status(500).json({ error: 'SVG-trin fejlede: ' + err.message })
  }
}

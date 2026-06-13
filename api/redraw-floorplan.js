// api/redraw-floorplan.js
// Trin 1: AI analyserer skitse → JSON
// Trin 2: Din egen kode renderer JSON → præcis SVG

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { imageBase64, mediaType = 'image/jpeg', address = '' } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'Mangler imageBase64' })

  const analysePrompt = `Du er en arkitektonisk assistent der analyserer håndtegnede danske plantegninger.

DANSKE FORKORTELSER:
- TR = Terrasse (separat blok, tynde vægge)
- GA = Garage (separat blok, tynde vægge)
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
- Alle mål i skitsen er centimeter

INSTRUKSER:
1. Identificér bygningens overordnede koordinatsystem. Placer øverste venstre hjørne af HELE layoutet (inkl. terrasse/garage) ved (0,0).
2. Mål er i centimeter. Brug cm direkte som koordinater.
3. Hvert rum har x, y (øverste venstre hjørne), width, height — alle i cm.
4. Terrasse/garage: separate blokke med egne koordinater.
5. For hver væg i hvert rum: angiv vinduer og døre med præcis position fra rummets øverste venstre hjørne.
6. Dørposition = afstand fra rummets hjørne til dørens start, langs den pågældende væg.

Returner KUN dette JSON (ingen markdown, ingen forklaring):

{
  "totalWidth": <samlet bredde i cm>,
  "totalHeight": <samlet højde i cm>,
  "address": "<adresse>",
  "northDirection": "up|down|left|right",
  "rooms": [
    {
      "id": "stue",
      "name": "Stue",
      "type": "living|bedroom|kitchen|bathroom|hallway|utility|terrace|garage|other",
      "x": 0,
      "y": 0,
      "width": 800,
      "height": 480,
      "ceilingHeight": 2.4,
      "isExterior": false,
      "walls": {
        "top":    { "windows": [{"pos": 100, "width": 120}], "doors": [{"pos": 300, "width": 90, "swing": "right", "inward": true}] },
        "bottom": { "windows": [], "doors": [] },
        "left":   { "windows": [], "doors": [] },
        "right":  { "windows": [], "doors": [] }
      },
      "cabinets": [
        {"wall": "top", "pos": 50, "width": 60, "depth": 60}
      ],
      "fixtures": ["stove", "sink", "refrigerator", "toilet", "bathtub", "shower", "washing_machine"]
    }
  ]
}`

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
        system: analysePrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: `Analyser denne håndtegnede plantegning præcist. Adresse: "${address}". Returner KUN JSON.` }
          ]
        }]
      })
    })

    const analyseData = await analyseRes.json()
    const rawText = analyseData.content?.map(b => b.text || '').join('') || ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/i)
    if (!jsonMatch) return res.status(500).json({ error: 'Analyse fejlede — ingen JSON returneret' })

    const floorplanData = JSON.parse(jsonMatch[0])
    if (address) floorplanData.address = address

    return res.status(200).json({ floorplanData })

  } catch (err) {
    console.error('API error:', err)
    return res.status(500).json({ error: err.message || 'Ukendt fejl' })
  }
}

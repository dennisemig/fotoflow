export const config = {
  api: { bodyParser: true, maxDuration: 60 }
}

const MW_ENDPOINT = 'https://nybolig.mindworking.eu/api/integrations/media/graphql/'
const MW_CLIENT_ID = process.env.MW_CLIENT_ID
const MW_SECRET = process.env.MW_SECRET

async function getToken() {
  const basicAuth = Buffer.from(`${MW_CLIENT_ID}:${MW_SECRET}`).toString('base64')
  const r = await fetch('https://iam.mindworking.eu/auth/realms/nybolig/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` },
    body: new URLSearchParams({ grant_type: 'client_credentials' })
  })
  const text = await r.text()
  let d
  try { d = JSON.parse(text) } catch (e) { throw new Error('Token svar ikke JSON: ' + text.slice(0, 200)) }
  if (!d.access_token) throw new Error('Ingen token: ' + JSON.stringify(d))
  console.log('Token type:', d.token_type, '| scope:', d.scope)
  return d.access_token
}

async function gql(token, query, variables = {}) {
  const r = await fetch(MW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables })
  })
  console.log('GraphQL status:', r.status)
  const text = await r.text()
  console.log('GraphQL svar:', text.slice(0, 150))
  let d
  try { d = JSON.parse(text) } catch (e) { throw new Error('GraphQL svar ikke JSON: ' + text.slice(0, 200)) }
  if (d.errors) throw new Error(d.errors[0].message)
  return d.data
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action, caseNo, billeder } = req.body

  try {
    const token = await getToken()

    if (action === 'test') {
      const data = await gql(token, `query { viewer { shopByShopNo(shopNo: "N260142") { id } } }`)
      return res.status(200).json({ success: true, shopId: data.viewer.shopByShopNo.id })
    }

    if (action === 'upload_billeder') {
      if (!caseNo || !billeder?.length) return res.status(400).json({ error: 'Mangler caseNo eller billeder' })

      console.log('Søger sag:', caseNo)
      const caseData = await gql(token, `
        query GetCase($shopNo: String!, $caseNo: String!) {
          viewer { caseByCaseNo(shopNo: $shopNo, caseNo: $caseNo) { id } }
        }`, { shopNo: 'N260142', caseNo })

      const caseId = caseData.viewer.caseByCaseNo?.id
      if (!caseId) return res.status(404).json({ error: `Sag ${caseNo} ikke fundet` })
      console.log('CaseId:', caseId)

      const resultater = []
      let position = 1
      const sorterede = [...billeder].sort((a, b) => (a.tag || 'Andet').localeCompare(b.tag || 'Andet'))

      for (const billede of sorterede) {
        try {
          console.log('Henter fil:', billede.navn)
          const fileResponse = await fetch(billede.url)
          if (!fileResponse.ok) { resultater.push({ navn: billede.navn, success: false, error: 'Hentning fejlede' }); continue }
          const fileBlob = await fileResponse.blob()
          console.log('Filstørrelse:', fileBlob.size, 'bytes')

          // Forsøg 1: REST upload endpoint
          const formData = new FormData()
          formData.append('file', fileBlob, billede.navn)
          formData.append('filename', billede.navn)
          formData.append('mimeType', fileBlob.type || 'image/jpeg')
          formData.append('caseId', caseId)

          const restUrl = 'https://nybolig.mindworking.eu/api/integrations/media/upload'
          console.log('Prøver REST upload til:', restUrl)
          const restR = await fetch(restUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          })
          console.log('REST status:', restR.status)
          const restText = await restR.text()
          console.log('REST svar:', restText.slice(0, 300))

          if (restR.ok) {
            let restData
            try { restData = JSON.parse(restText) } catch {}
            const mediaId = restData?.id || restData?.mediaId || 'ok'
            resultater.push({ navn: billede.navn, success: true, mediaId })
            position++
            continue
          }

          // Forsøg 2: Alternativt REST endpoint med caseId i URL
          const restUrl2 = `https://nybolig.mindworking.eu/api/integrations/media/upload/${caseId}`
          console.log('Prøver alternativt REST upload til:', restUrl2)
          const restR2 = await fetch(restUrl2, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          })
          console.log('REST2 status:', restR2.status)
          const restText2 = await restR2.text()
          console.log('REST2 svar:', restText2.slice(0, 300))

          if (restR2.ok) {
            resultater.push({ navn: billede.navn, success: true })
            position++
            continue
          }

          resultater.push({ navn: billede.navn, success: false, error: `REST fejlede: ${restR.status} / ${restR2.status}` })

        } catch (e) {
          resultater.push({ navn: billede.navn, success: false, error: e.message })
        }
      }

      return res.status(200).json({ success: true, resultater, total: resultater.length, uploadet: resultater.filter(r => r.success).length })
    }

    res.status(400).json({ error: 'Ukendt action' })
  } catch (e) {
    console.error('Mindworking fejl:', e)
    res.status(500).json({ error: e.message })
  }
}

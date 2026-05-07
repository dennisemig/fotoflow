export const config = {
  api: { bodyParser: false, maxDuration: 60 }
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

  const body = await new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => data += chunk)
    req.on('end', () => { try { resolve(JSON.parse(data)) } catch(e) { reject(e) } })
    req.on('error', reject)
  })
  const { action, caseNo, billeder } = body

  try {
    const token = await getToken()

    if (action === 'test') {
      const data = await gql(token, `query { viewer { shopByShopNo(shopNo: "N260142") { id } } }`)
      return res.status(200).json({ success: true, shopId: data.viewer.shopByShopNo.id })
    }

    if (action === 'get_case') {
      if (!caseNo) return res.status(400).json({ error: 'Mangler caseNo' })
      console.log('Henter sag:', caseNo)
      const data = await gql(token, `
        query GetCase($shopNo: String!, $caseNo: String!) {
          viewer {
            caseByCaseNo(shopNo: $shopNo, caseNo: $caseNo) {
              id
              caseNo
              liebhaveri
              address
              media {
                items {
                  id
                  fileName
                  resourceUrl
                  published
                  description
                  mediaType
                  tags
                }
              }
            }
          }
        }
      `, { shopNo: 'N260142', caseNo })
      return res.status(200).json({ success: true, case: data.viewer.caseByCaseNo })
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

          // Præcis format fra Mindworkings HAR fil
          const operations = JSON.stringify({
            query: `mutation createMedia($input: CreateMediaInput!) { createMedia(input: $input) { id fileName published tags resourceUrl } }`,
            variables: {
              input: {
                caseId: caseId,
                description: "",
                mediaType: "image/jpg",
                published: true,
                tags: billede.tag ? [billede.tag] : [],
                file: null
              }
            }
          })

          const mfData = new FormData()
          mfData.append('operations', operations)
          mfData.append('map', JSON.stringify({ "0": ["variables.input.file"] }))
          mfData.append('0', fileBlob, billede.navn)

          console.log('Sender multipart til Mindworking')
          const mfR = await fetch(MW_ENDPOINT, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: mfData
          })
          console.log('Multipart status:', mfR.status)
          const mfText = await mfR.text()
          console.log('Multipart svar:', mfText.slice(0, 300))

          let mfJson
          try { mfJson = JSON.parse(mfText) } catch {}

          if (mfJson?.data?.createMedia?.id) {
            resultater.push({ navn: billede.navn, success: true, mediaId: mfJson.data.createMedia.id })
            position++
            continue
          }

          resultater.push({ navn: billede.navn, success: false, error: mfText.slice(0, 200) })

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

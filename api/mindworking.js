export const config = {
  api: {
    bodyParser: true,
    maxDuration: 60,
  },
}

const MW_ENDPOINT = 'https://nybolig.mindworking.eu/api/integrations/media/graphql/'
const MW_CLIENT_ID = process.env.MW_CLIENT_ID
const MW_SECRET = process.env.MW_SECRET

async function getToken() {
  // Basic Auth header: base64(client_id:client_secret)
  const basicAuth = Buffer.from(`${MW_CLIENT_ID}:${MW_SECRET}`).toString('base64')
  const r = await fetch('https://iam.mindworking.eu/auth/realms/nybolig/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials'
    })
  })
  const text = await r.text()
  let d
  try { d = JSON.parse(text) } catch (e) { throw new Error('Token svar ikke JSON: ' + text.slice(0, 200)) }
  if (!d.access_token) throw new Error('Ingen token: ' + JSON.stringify(d))
  console.log('Token type:', d.token_type)
  console.log('Token scope:', d.scope)
  return d.access_token
}

async function gql(token, query, variables = {}) {
  console.log('GraphQL kald til:', MW_ENDPOINT)
  console.log('Token (første 20 tegn):', token?.slice(0, 20))
  const r = await fetch(MW_ENDPOINT, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  })
  console.log('GraphQL status:', r.status)
  const text = await r.text()
  console.log('GraphQL svar (første 100):', text.slice(0, 100))
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
      // Test forbindelsen
      const data = await gql(token, `
        query {
          viewer {
            shopByShopNo(shopNo: "N260142") {
              id
            }
          }
        }
      `)
      return res.status(200).json({ success: true, shopId: data.viewer.shopByShopNo.id })
    }

    if (action === 'get_case') {
      // Hent sag fra Mindworking
      const data = await gql(token, `
        query GetCase($shopNo: String!, $caseNo: String!) {
          viewer {
            caseByCaseNo(shopNo: $shopNo, caseNo: $caseNo) {
              id
              liebhaveri
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
      // Upload billeder til Mindworking sag
      if (!caseNo || !billeder?.length) {
        return res.status(400).json({ error: 'Mangler caseNo eller billeder' })
      }

      console.log('Søger efter sag med shopNo: N260142, caseNo:', caseNo)
      // Hent case ID fra Mindworking
      const caseData = await gql(token, `
        query GetCase($shopNo: String!, $caseNo: String!) {
          viewer {
            caseByCaseNo(shopNo: $shopNo, caseNo: $caseNo) {
              id
            }
          }
        }
      `, { shopNo: 'N260142', caseNo })

      const caseId = caseData.viewer.caseByCaseNo?.id
      if (!caseId) return res.status(404).json({ error: `Sag ${caseNo} ikke fundet i Mindworking` })

      const resultater = []
      let position = 1

      // Gruppér billeder efter tag for korrekt rækkefølge
      const sorterede = [...billeder].sort((a, b) => (a.tag || 'Andet').localeCompare(b.tag || 'Andet'))

      for (const billede of sorterede) {
        try {
          // Hent filen fra Supabase
          console.log('Henter fil:', billede.navn)
          const fileResponse = await fetch(billede.url)
          if (!fileResponse.ok) {
            resultater.push({ navn: billede.navn, success: false, error: 'Kunne ikke hente fil fra Supabase' })
            continue
          }
          const fileBlob = await fileResponse.blob()
          console.log('Fil størrelse:', fileBlob.size, 'bytes')

          // Send createMedia MED fil i samme multipart kald
          const formData = new FormData()
          
          // GraphQL multipart spec: https://github.com/jaydenseric/graphql-multipart-request-spec
          formData.append('operations', JSON.stringify({
            query: `mutation ($caseId: ID!, $file: Upload!) { 
              createMedia(input: { caseId: $caseId, file: $file }) { 
                id fileName 
              } 
            }`,
            variables: { caseId: caseId, file: null }
          }))
          formData.append('map', JSON.stringify({ "1": ["variables.file"] }))
          formData.append('1', fileBlob, billede.navn)

          console.log('Sender multipart createMedia+fil til Mindworking')
          const uploadR = await fetch(MW_ENDPOINT, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          })
          console.log('Upload status:', uploadR.status)
          const uploadText = await uploadR.text()
          console.log('Upload svar:', uploadText.slice(0, 300))

          if (!uploadR.ok) {
            resultater.push({ navn: billede.navn, success: false, error: `Upload fejlede: ${uploadR.status} ${uploadText.slice(0, 100)}` })
            continue
          }

          let uploadData
          try { uploadData = JSON.parse(uploadText) } catch (e) {
            resultater.push({ navn: billede.navn, success: false, error: 'Svar ikke JSON' })
            continue
          }

          if (!uploadData.data?.createMedia?.id) {
            resultater.push({ navn: billede.navn, success: false, error: 'createMedia fejlede: ' + uploadText.slice(0, 200) })
            continue
          }

          const mediaId = uploadData.data.createMedia.id
          console.log('Media oprettet med ID:', mediaId)

          // 3. Opdater med tag, position og beskrivelse
          await gql(token, `
            mutation updateMedia($id: ID!, $position: Int!, $tags: [String!], $mediaType: String!) {
              updateMedias(input: {
                medias: [{
                  id: $id
                  position: $position
                  tags: $tags
                  mediaType: $mediaType
                }]
              }) {
                id
              }
            }
          `, {
            id: mediaId,
            position,
            tags: billede.tag ? [billede.tag] : [],
            mediaType: 'Billede'
          })

          resultater.push({ navn: billede.navn, success: true, mediaId })
          position++
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

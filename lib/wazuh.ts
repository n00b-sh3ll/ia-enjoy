/**
 * Helper de integração com a API do Wazuh.
 * Coloque as variáveis em .env.local: WAZUH_API_URL e WAZUH_API_TOKEN
 * Uso exemplo:
 *   import { fetchAlerts } from '../lib/wazuh'
 *   const alerts = await fetchAlerts('?limit=50')
 */

const defaultPort = '55000'

const getBaseUrl = () => {
  const raw = process.env.WAZUH_API_URL
  if (!raw) throw new Error('WAZUH_API_URL não configurado')

  // Normalize: ensure no trailing slash and include default port if absent
  try {
    const u = new URL(raw)
    if (!u.port) u.port = defaultPort
    return u.toString().replace(/\/$/, '')
  } catch (err) {
    // If user provided no scheme, assume https
    const withProto = raw.startsWith('http') ? raw : `https://${raw}`
    const u = new URL(withProto)
    if (!u.port) u.port = defaultPort
    return u.toString().replace(/\/$/, '')
  }
}

let tokenCache: { token: string; exp?: number } | null = null

async function obtainTokenFromApi() {
  const user = process.env.WAZUH_USERNAME
  const pass = process.env.WAZUH_PASSWORD
  if (!user || !pass) throw new Error('WAZUH_USERNAME/WAZUH_PASSWORD não configurados')

  const base = getBaseUrl()
  const url = `${base}/security/user/authenticate`
  const basic = Buffer.from(`${user}:${pass}`).toString('base64')

  const res = await fetch(`${url}?raw=false`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basic}`,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Auth error ${res.status}: ${text}`)
  }

  const body = await res.json()
  // response shape: { data: { token: '...' }, error: 0 }
  const token = body?.data?.token
  if (!token) throw new Error('Token não retornado pela API Wazuh')

  // Note: JWT contains exp — we could parse and cache; keep simple caching
  tokenCache = { token }
  return token
}

async function getToken() {
  // Prefer explicit token
  const envToken = process.env.WAZUH_API_TOKEN
  if (envToken) return envToken

  if (tokenCache && tokenCache.token) return tokenCache.token
  return obtainTokenFromApi()
}

export async function wazuhFetch(path = '', init?: RequestInit) {
  const base = getBaseUrl()
  const target = path.startsWith('http') ? path : `${base}${path}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const token = await getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(target, {
    method: init?.method || 'GET',
    headers: { ...headers, ...(init?.headers as Record<string, string> || {}) },
    body: init?.body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Wazuh API error ${res.status}: ${text}`)
  }

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return res.json()
  return res.text()
}

/**
 * Função utilitária para buscar alertas. Ajuste o path conforme sua versão do Wazuh.
 * Exemplo de path: '/alerts' ou '/security/alerts'
 */
export async function fetchAlerts(query = '') {
  // Busca do Elasticsearch com filtro de nível >= 5
  const envIndex = process.env.WAZUH_ALERTS_PATH || 'wazuh-alerts-*'
  const esBase = process.env.ELASTICSEARCH_URL || 'https://192.168.150.210:9200'
  const esUser = process.env.ELASTICSEARCH_USERNAME
  const esPass = process.env.ELASTICSEARCH_PASSWORD

  if (!esUser || !esPass) {
    throw new Error('ELASTICSEARCH_USERNAME/ELASTICSEARCH_PASSWORD não configurados')
  }

  // Parse paginação
  const params = new URLSearchParams(query?.replace(/^\?/, ''))
  const size = params.get('limit') || params.get('size') || '50'
  const from = params.get('offset') || '0'

  const esUrl = `${esBase.replace(/\/$/, '')}/${envIndex}/_search`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  headers.Authorization = `Basic ${Buffer.from(`${esUser}:${esPass}`).toString('base64')}`

  // Query igual ao script Python
  const payload = {
    query: {
      bool: {
        filter: [
          { range: { 'rule.level': { gte: 5 } } }
        ]
      }
    },
    size: parseInt(size),
    from: parseInt(from),
    sort: [{ '@timestamp': { order: 'desc' } }]
  }

  const res = await fetch(esUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Elasticsearch error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function fetchAlertById(id: string) {
  if (!id) throw new Error('id é requerido')
  return wazuhFetch(`/security/alerts/${encodeURIComponent(id)}`)
}

export default {
  wazuhFetch,
  fetchAlerts,
  fetchAlertById,
}

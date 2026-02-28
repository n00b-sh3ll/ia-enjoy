import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { getAlertsFromDB, getAlertStats, getLastSyncLog } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const level = url.searchParams.get('level')
    const search = url.searchParams.get('search')
    const useDB = url.searchParams.get('useDB') !== 'false' // Usar banco de dados por padrão

    if (useDB) {
      // Buscar do banco de dados SQLite
      const filters: any = {}
      if (level) filters.level = parseInt(level)
      if (search) filters.search = search

      const { alerts, total } = await getAlertsFromDB(limit, offset, filters)

      // Converter para formato compatível com ES
      const formattedAlerts = alerts.map((alert) => ({
        _id: alert.id,
        _source: {
          ...alert,
          '@timestamp': alert.timestamp,
          rule: {
            level: alert.level,
            name: alert.ruleName,
            id: alert.ruleId,
            description: alert.description,
          },
          agent: {
            name: alert.agentName,
          },
          source_ip: alert.source,
          destination_ip: alert.destination,
        },
      }))

      return NextResponse.json({
        hits: {
          hits: formattedAlerts,
          total: { value: total },
        },
      })
    } else {
      // Buscar do Elasticsearch (fallback)
      const data = await fetchAlertsViaSSH(request)
      return NextResponse.json(data)
    }
  } catch (err: any) {
    console.error('[API /alerts] Error:', err)
    return NextResponse.json(
      {
        error: err?.message || String(err),
        errorDetails: err?.cause?.message || err?.stack?.substring(0, 200) || '',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/alerts/stats - Retorna estatísticas dos alertas
 */
export async function getStats() {
  try {
    const stats = await getAlertStats()
    const lastSync = await getLastSyncLog()
    return {
      ...stats,
      lastSync: lastSync?.lastSync,
      syncStatus: lastSync?.status,
    }
  } catch (err: any) {
    console.error('[API /alerts/stats] Error:', err)
    throw err
  }
}

// Helper to fetch alerts via SSH on the server
async function fetchAlertsViaSSH(request: Request) {
  const url = new URL(request.url)
  
  const limit = url.searchParams.get('limit') || '50'
  const offset = url.searchParams.get('offset') || '0'
  const level = url.searchParams.get('level') || ''

  const sshUser = process.env.SSH_USER || 'usuario'
  const sshHost = process.env.SSH_HOST || '192.168.150.210'
  
  // Construir filtro de level dinamicamente
  let levelFilter = '{"range":{"rule.level":{"gte":5}}}'
  if (level) {
    // Se level é fornecido, filtrar por nível exato
    levelFilter = `{"term":{"rule.level":${level}}}`
  }
  
  // Use a bash heredoc to pass the Python script cleanly, avoiding escaping issues
  const shellScript = `ssh -n -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${sshUser}@${sshHost} 'python3 << PYTHONEOF
import requests,json
from urllib3.exceptions import InsecureRequestWarning
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)
try:
    r=requests.post("https://localhost:9200/wazuh-alerts-*/_search",auth=("admin","SmiPV2J7d8L?j26RfkLkRDC?Sa.7JZB8"),json={"query":{"bool":{"filter":[${levelFilter}]}},"size":${limit},"from":${offset},"sort":[{"@timestamp":{"order":"desc"}}]},verify=False,timeout=30)
    result=r.json()
    print(json.dumps({"hits":{"hits":result.get("hits",{}).get("hits",[]),"total":result.get("hits",{}).get("total",{})}}))
except Exception as e:
    import sys
    print(json.dumps({"error":str(e)}),file=sys.stderr)
    sys.exit(1)
PYTHONEOF
'`

  try {
    const result = execSync(shellScript, {
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: '/bin/bash',
      env: { ...process.env }
    })
    return JSON.parse(result)
  } catch (err: any) {
    console.error('[SSH] SSH command failed:', err.message)
    throw new Error(`SSH fetch failed: ${err.message}`)
  }
}

import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const limit = body.limit || 500

    // Buscar alertas do Elasticsearch
    const alertsData = await fetchAlertsViaSSH(limit)

    if (!alertsData.hits?.hits || alertsData.hits.hits.length === 0) {
      return NextResponse.json({ message: 'No alerts to sync', count: 0 })
    }

    // Tentar sincronizar para o banco de dados Prisma
    try {
      const { syncAlertsFromES } = await import('@/lib/db')
      const result = await syncAlertsFromES(alertsData.hits.hits)

      return NextResponse.json({
        message: 'Alerts synced successfully',
        count: result.count,
        total: alertsData.hits?.total?.value ?? alertsData.hits?.total ?? 0,
      })
    } catch (dbErr: any) {
      // Se Prisma falhar, retornar resposta com aviso
      console.warn('[API /sync-alerts] Database sync failed:', dbErr?.message)
      return NextResponse.json(
        {
          message: 'Alerts fetched from Elasticsearch but database sync failed',
          warning: dbErr?.message,
          count: alertsData.hits.hits.length,
          total: alertsData.hits?.total?.value ?? alertsData.hits?.total ?? 0,
        },
        { status: 206 } // Partial Content
      )
    }
  } catch (err: any) {
    console.error('[API /sync-alerts] Error:', err)
    return NextResponse.json(
      {
        error: err?.message || String(err),
        errorDetails: String(err).substring(0, 200),
      },
      { status: 500 }
    )
  }
}

// Helper to fetch alerts via SSH on the server
async function fetchAlertsViaSSH(limit: number) {
  const sshUser = process.env.SSH_USER || 'usuario'
  const sshHost = process.env.SSH_HOST || '192.168.150.210'

  const levelFilter = `{"range":{"rule.level":{"gte":5}}}`

  const shellScript = `ssh -n -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${sshUser}@${sshHost} 'python3 << PYTHONEOF
import requests,json
from urllib3.exceptions import InsecureRequestWarning
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)
try:
    r=requests.post("https://localhost:9200/wazuh-alerts-*/_search",auth=("admin","SmiPV2J7d8L?j26RfkLkRDC?Sa.7JZB8"),json={"query":{"bool":{"filter":[${levelFilter}]}},"size":${limit},"sort":[{"@timestamp":{"order":"desc"}}]},verify=False,timeout=30)
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
      env: { ...process.env },
    })
    return JSON.parse(result)
  } catch (err: any) {
    console.error('[SSH] SSH command failed:', err.message)
    throw new Error(`SSH fetch failed: ${err.message}`)
  }
}

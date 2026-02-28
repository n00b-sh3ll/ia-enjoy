/**
 * Helper para executar comandos via SSH no servidor Wazuh
 * e coletar alertas do Elasticsearch localmente
 */

const SSHUser = process.env.SSH_USER || 'usuario'
const SSHHost = process.env.SSH_HOST || '192.168.150.210'
const SSHKey = process.env.SSH_KEY_PATH || process.env.HOME + '/.ssh/id_rsa'

export async function fetchAlertsViaSSH(limit = 50, offset = 0) {
  // Para Node.js, usar child_process + ssh-exec
  // Alternativa: usar biblioteca 'ssh2' ou 'node-ssh'

  const { execSync } = require('child_process')

  try {
    // Comando SSH que executa o script remoto
    const command = `ssh -i ${SSHKey} ${SSHUser}@${SSHHost} 'bash /tmp/fetch-alerts.sh ${limit} ${offset}'`

    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    })

    return JSON.parse(result)
  } catch (err: any) {
    console.error('[SSH Alert Fetch] Error:', err.message)
    throw new Error(`SSH query failed: ${err.message}`)
  }
}

/**
 * Deploy o script remoto para o servidor via SSH (one-time setup)
 */
export async function deployRemoteScript() {
  const { execSync } = require('child_process')
  const fs = require('fs')
  const path = require('path')

  try {
    const scriptPath = path.join(process.cwd(), 'remote-scripts', 'fetch-alerts.sh')
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8')

    // Copiar script remoto e fazer executable
    const command = `echo '${scriptContent.replace(/'/g, "'\\''")}' | ssh -i ${SSHKey} ${SSHUser}@${SSHHost} 'cat > /tmp/fetch-alerts.sh && chmod +x /tmp/fetch-alerts.sh'`

    execSync(command, { stdio: 'inherit', timeout: 10000 })
    console.log('[SSH Deploy] Script deployed to /tmp/fetch-alerts.sh')
  } catch (err: any) {
    console.error('[SSH Deploy] Error:', err.message)
    throw err
  }
}

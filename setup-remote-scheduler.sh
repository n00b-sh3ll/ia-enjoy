#!/bin/bash
# Setup script to deploy fetch-alerts.sh e instalar cron job no servidor Wazuh
# Uso: ./setup-remote-scheduler.sh

SSH_USER="${SSH_USER:-usuario}"
SSH_HOST="${SSH_HOST:-192.168.150.210}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"

echo "🔧 Setup Remote Alert Scheduler"
echo "================================"
echo "SSH User: $SSH_USER"
echo "SSH Host: $SSH_HOST"
echo "SSH Key: $SSH_KEY"
echo ""

# 1. Copiar script para servidor
echo "📤 Deploying fetch-alerts.sh to $SSH_HOST..."
ssh -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" "mkdir -p /tmp/wazuh-alerts && cat > /tmp/wazuh-alerts/fetch-alerts.sh << 'SCRIPT_END'
#!/bin/bash
ES_HOST=\"localhost:9200\"
ES_USER=\"\${ELASTICSEARCH_USERNAME:-}\"
ES_PASS=\"\${ELASTICSEARCH_PASSWORD:-}\"
INDEX=\"wazuh-alerts-*\"
LIMIT=\${1:-50}
OFFSET=\${2:-0}
if [[ -z \"\$ES_USER\" || -z \"\$ES_PASS\" ]]; then
	echo \"Missing ELASTICSEARCH_USERNAME or ELASTICSEARCH_PASSWORD\" >&2
	exit 1
fi
curl -s -k -u \"\$ES_USER:\$ES_PASS\" -X POST \"http://\$ES_HOST/\$INDEX/_search\" -H \"Content-Type: application/json\" -d \"{\\\"query\\\": {\\\"bool\\\": {\\\"filter\\\": [{\\\"range\\\": {\\\"rule.level\\\": {\\\"gte\\\": 5}}}]}},\\\"size\\\": \$LIMIT,\\\"from\\\": \$OFFSET,\\\"sort\\\": [{\\\"@timestamp\\\": {\\\"order\\\": \\\"desc\\\"}}]}\" | jq '.hits.hits'
SCRIPT_END
chmod +x /tmp/wazuh-alerts/fetch-alerts.sh"

echo "✅ Script deployed"
echo ""

# 2. (Opcional) Instalar cron job para coletar e armazenar alertas a cada 5 minutos
echo "📅 Setting up cron job (optional)..."
CRONLOCK="/tmp/wazuh-alerts/fetch-alerts-last.json"
CRON_CMD="/tmp/wazuh-alerts/fetch-alerts.sh 100 0 > $CRONLOCK 2>&1"

ssh -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" "(crontab -l 2>/dev/null | grep -v 'fetch-alerts'; echo '*/5 * * * * $CRON_CMD') | crontab -"

echo "✅ Cron job installed (runs every 5 minutes)"
echo ""

# 3. Testar
echo "🧪 Testing remote script..."
ssh -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" "/tmp/wazuh-alerts/fetch-alerts.sh 1" | jq '.[] | {agent: ._source.agent, level: ._source.rule.level, desc: ._source.rule.description}' | head -20

echo ""
echo "🎉 Setup complete! Alerts are now collected on the server."
echo ""
echo "Dashboard URL: http://localhost:3001/dashboard"
echo ""

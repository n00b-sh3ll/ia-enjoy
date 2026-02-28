#!/bin/bash
# Script para executar no servidor Wazuh
# Busca alertas do Elasticsearch via localhost:9200

set -e

ES_HOST="localhost:9200"
ES_USER="${ELASTICSEARCH_USERNAME:-}"
ES_PASS="${ELASTICSEARCH_PASSWORD:-}"
INDEX="wazuh-alerts-*"

if [[ -z "$ES_USER" || -z "$ES_PASS" ]]; then
  echo "Missing ELASTICSEARCH_USERNAME or ELASTICSEARCH_PASSWORD" >&2
  exit 1
fi

# Parse parameters
LIMIT=${1:-50}
OFFSET=${2:-0}

# Execute ES query via localhost
curl -s -k -u "$ES_USER:$ES_PASS" \
  -X POST "http://$ES_HOST/$INDEX/_search" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": {
      \"bool\": {
        \"filter\": [
          { \"range\": { \"rule.level\": { \"gte\": 5 } } }
        ]
      }
    },
    \"size\": $LIMIT,
    \"from\": $OFFSET,
    \"sort\": [
      { \"@timestamp\": { \"order\": \"desc\" } }
    ]
  }" | jq '.hits.hits'

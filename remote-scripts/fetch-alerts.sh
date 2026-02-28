#!/bin/bash
# Script para executar no servidor Wazuh
# Busca alertas do Elasticsearch via localhost:9200

set -e

ES_HOST="localhost:9200"
ES_USER="admin"
ES_PASS="SmiPV2J7d8L?j26RfkLkRDC?Sa.7JZB8"
INDEX="wazuh-alerts-*"

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

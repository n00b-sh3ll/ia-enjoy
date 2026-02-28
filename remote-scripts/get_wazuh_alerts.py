#!/usr/bin/env python3
"""
Script to fetch Wazuh alerts from Elasticsearch running on localhost:9200
Executes on the remote Wazuh server to avoid network barriers
"""
import requests
import json
import sys
from urllib3.exceptions import InsecureRequestWarning

# Disable SSL warnings for self-signed certificates
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

url = "https://localhost:9200/wazuh-alerts-*/_search"
auth = ('admin', 'SmiPV2J7d8L?j26RfkLkRDC?Sa.7JZB8')

# Parse limit and offset from command line arguments
limit = int(sys.argv[1]) if len(sys.argv) > 1 else 50
offset = int(sys.argv[2]) if len(sys.argv) > 2 else 0

payload = {
    "query": {
        "bool": {
            "filter": [
                {"range": {"rule.level": {"gte": 5}}}
            ]
        }
    },
    "size": limit,
    "from": offset,
    "sort": [{"@timestamp": {"order": "desc"}}]
}

try:
    r = requests.post(url, auth=auth, json=payload, verify=False, timeout=30)
    r.raise_for_status()
    result = r.json()
    
    # Return the hits array so Node.js can parse it
    print(json.dumps({
        "hits": result.get("hits", {}).get("hits", []),
        "total": result.get("hits", {}).get("total", {})
    }))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)

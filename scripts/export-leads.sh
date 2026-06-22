#!/usr/bin/env bash
# Export captured tool emails to a CSV for importing into Substack.
# Usage: bash scripts/export-leads.sh [output.csv]
set -e
export PATH="/opt/homebrew/bin:$PATH"
NS="225ff03f16ca40daae58aa860aaddc85"   # LEADS KV namespace
OUT="${1:-leads.csv}"
echo "email" > "$OUT"
npx --yes wrangler kv key list --namespace-id "$NS" --remote 2>/dev/null \
  | python3 -c 'import json,sys; [print(k["name"][6:]) for k in json.load(sys.stdin) if k["name"].startswith("email:")]' >> "$OUT"
echo "Wrote $(( $(wc -l < "$OUT") - 1 )) email(s) to $OUT"

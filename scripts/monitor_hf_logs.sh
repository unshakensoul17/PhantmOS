#!/usr/bin/env bash
# scripts/monitor_hf_logs.sh — Real-time live log streamer for Hugging Face Space

# Auto-load token from environment, git remote config, or .env
if [ -z "$HF_TOKEN" ]; then
  HF_TOKEN=$(git remote get-url space 2>/dev/null | grep -o 'hf_[A-Za-z0-9_]*')
fi

if [ -z "$HF_TOKEN" ] && [ -f ".env" ]; then
  HF_TOKEN=$(grep -E "^(HF_TOKEN|HF_API_KEY)=" .env | head -n 1 | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r' | tr -d ' ')
fi

SPACE_REPO="${HF_SPACE_REPO:-Unshakensoul17/PhantmOS}"

if [ -z "$HF_TOKEN" ]; then
  read -s -p "Enter Hugging Face Token: " HF_TOKEN
  echo ""
fi

# Trim any trailing carriage returns or whitespace
HF_TOKEN=$(echo "$HF_TOKEN" | tr -d '\r' | tr -d ' ')

echo "========================================================================"
echo " 📡 PhantmOS Live Backend Log Streamer (Hugging Face Space)"
echo " Repository : $SPACE_REPO"
echo " Press Ctrl+C at any time to stop monitoring"
echo "========================================================================"

while true; do
  curl -s -N --location-trusted \
       -H "Authorization: Bearer $HF_TOKEN" \
       "https://huggingface.co/api/spaces/${SPACE_REPO}/logs/run" | \
  python3 -u -c '
import sys, json
for line in sys.stdin:
    line = line.strip()
    if line.startswith("data: "):
        raw = line[6:]
        try:
            payload = json.loads(raw)
            msg = payload.get("data", raw)
            sys.stdout.write(msg if msg.endswith("\n") else msg + "\n")
            sys.stdout.flush()
        except Exception:
            print(raw)
    elif line and not line.startswith(": keep-alive"):
        print(line)
'
  
  echo -e "\n[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  Stream interrupted. Reconnecting in 3s..."
  sleep 3
done

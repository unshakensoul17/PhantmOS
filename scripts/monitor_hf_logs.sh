#!/usr/bin/env bash
# scripts/monitor_hf_logs.sh — Real-time live log streamer for Hugging Face Space

HF_TOKEN="${HF_TOKEN:-}"
SPACE_REPO="${HF_SPACE_REPO:-Unshakensoul17/PhantmOS}"

if [ -z "$HF_TOKEN" ]; then
  read -s -p "Enter Hugging Face Token: " HF_TOKEN
  echo ""
fi

echo "========================================================================"
echo " 📡 PhantmOS Live Backend Log Streamer (Hugging Face Space)"
echo " Repository : $SPACE_REPO"
echo " Press Ctrl+C at any time to stop monitoring"
echo "========================================================================"

while true; do
  curl -s -L -N \
       -H "Authorization: Bearer $HF_TOKEN" \
       "https://huggingface.co/api/spaces/${SPACE_REPO}/logs/run"
  
  echo -e "\n[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  Stream interrupted. Reconnecting in 3s..."
  sleep 3
done

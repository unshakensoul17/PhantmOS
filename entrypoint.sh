#!/bin/bash
set -euo pipefail

XVFB_DISPLAY="${XVFB_DISPLAY:-:99}"
XVFB_RESOLUTION="${XVFB_RESOLUTION:-1920x1080x24}"

Xvfb "$XVFB_DISPLAY" -screen 0 "$XVFB_RESOLUTION" &
export DISPLAY="$XVFB_DISPLAY"

# Start the autonomous orchestrator in the background
python main_orchestrator.py &

# Start the Command Center Dashboard on port 7860 (Required by Hugging Face)
exec uvicorn dashboard:app --host 0.0.0.0 --port 7860

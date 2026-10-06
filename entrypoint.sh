#!/bin/bash
set -euo pipefail

# Start the autonomous orchestrator in the background
python main_orchestrator.py &

# Start the Command Center Dashboard in the background on port 8080
uvicorn dashboard:app --host 127.0.0.1 --port 8080 &

# Start the TanStack Start (Nitro) frontend server on port 7860
export PORT=7860
exec node /app/frontend/.output/server/index.mjs

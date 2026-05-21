#!/bin/bash
set -euo pipefail

# Start the autonomous orchestrator in the background
python main_orchestrator.py &

# Start the Command Center Dashboard on port 7860 (Required by Hugging Face)
exec uvicorn dashboard:app --host 0.0.0.0 --port 7860

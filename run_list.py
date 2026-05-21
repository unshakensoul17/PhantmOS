import subprocess
import json
import time

req = {
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
        "name": "list_tables",
        "arguments": {}
    }
}

init_req = {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
notif_req = {"jsonrpc":"2.0","id":2,"method":"notifications/initialized"}

commands = [
    json.dumps(init_req),
    json.dumps(notif_req),
    json.dumps(req)
]

process = subprocess.Popen(
    ["/usr/bin/npx", "-y", "@supabase/mcp-server-supabase@latest", "--access-token", "[REDACTED]", "--project-ref", "cdnouumbpzxnxslquodj"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

for cmd in commands:
    process.stdin.write(cmd + "\n")
process.stdin.flush()

for line in process.stdout:
    if '"id":3' in line:
        print(line.strip())
        break
process.terminate()

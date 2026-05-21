import subprocess
import json
import time

with open("schema.sql", "r") as f:
    sql = f.read()

req = {
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
        "name": "execute_sql",
        "arguments": {
            "query": sql
        }
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
    print(line.strip())
    if '"id":3' in line:
        break
process.terminate()

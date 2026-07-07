import json
import glob
import re

files = [
    "prompt1", "prompt 2 json", "prompt 3json", 
    "prompt4 json", "prompt 5 json", "prompt 6json"
]

merged = {}
total_keys = 0
invalid_files = []

for f_name in files:
    try:
        with open(f_name, 'r') as f:
            content = f.read()
            
            # Often LLMs wrap JSON in markdown like ```json ... ```
            content = re.sub(r'```json', '', content)
            content = re.sub(r'```', '', content)
            
            data = json.loads(content.strip())
            
            # Merge logic
            for k, v in data.items():
                if k in merged:
                    merged[k] = list(set(merged[k] + v))
                else:
                    merged[k] = v
                    
    except Exception as e:
        invalid_files.append((f_name, str(e)))

print(f"Successfully processed {len(files) - len(invalid_files)} / {len(files)} files.")
print(f"Total distinct job families combined: {len(merged.keys())}")
if invalid_files:
    print(f"Errors in files: {invalid_files}")

# Calculate average keywords per job family
if merged:
    avg_keywords = sum(len(v) for v in merged.values()) / len(merged.keys())
    print(f"Average keywords per job family: {avg_keywords:.2f}")

    # Check for excessive keywords (e.g. over 20)
    large_families = {k: len(v) for k, v in merged.items() if len(v) > 20}
    print(f"Job families with > 20 keywords: {len(large_families)}")
    if large_families:
        print("Sample of large families:", list(large_families.keys())[:5])

import json
with open("taxonomy.json", "w") as f:
    json.dump(merged, f, indent=4)
print("Saved combined result to taxonomy.json")


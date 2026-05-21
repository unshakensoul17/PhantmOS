import os
import json
import subprocess
from pathlib import Path

def generate_pdf(updated_resume_json: dict, output_path: str):
    """
    Generate a flawless LaTeX-style PDF using RenderCV from a JSON structure.
    """
    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    
    # RenderCV expects the file to be present on disk
    temp_json_path = out_path.with_suffix('.json')
    
    try:
        with open(temp_json_path, 'w', encoding='utf-8') as f:
            json.dump(updated_resume_json, f, indent=4)
            
        # Call RenderCV CLI 
        import sys
        rendercv_cmd = os.path.join(os.path.dirname(sys.executable), "rendercv")
        cmd = [
            rendercv_cmd, 
            "render", 
            str(temp_json_path),
            "--pdf-path",
            str(out_path),
            "--dont-generate-markdown",
            "--dont-generate-html",
            "--dont-generate-png"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"[PDF Factory] RenderCV Failed:\nSTDERR: {result.stderr}\nSTDOUT: {result.stdout}")
            return None
            
        # The PDF was saved directly to `out_path`
        if out_path.exists():
            # Clean up the temp JSON
            if temp_json_path.exists():
                pass # temp_json_path.unlink()
                
            return str(out_path)
        else:
            print("[PDF Factory] No PDF found at the target location after RenderCV finished.")
            return None
            
    except Exception as e:
        print(f"[PDF Factory] Error compiling PDF: {e}")
        return None

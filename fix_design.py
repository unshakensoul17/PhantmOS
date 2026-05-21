import sys
sys.path.append('.')
from core.database_manager import get_client, get_profile

client = get_client()
profile = get_profile()
if profile and "resume_data" in profile:
    resume_data = profile["resume_data"]
    
    # Inject a design block to fix the margins and the date column width
    resume_data["design"] = {
        "theme": "classic",
        "page": {
            "left_margin": "0.5in",
            "right_margin": "0.5in",
            "top_margin": "0.5in",
            "bottom_margin": "0.5in"
        },
        "entries": {
            "date_and_location_width": "2.1cm"
        }
    }
    
    # Optional: we can remove the dummy date we added earlier if it looks bad
    # Let's keep it or remove it. We'll leave it since it doesn't hurt.
    
    client.table("user_profiles").update({"resume_data": resume_data}).eq("id", profile["id"]).execute()
    print("Updated user_profiles with new design schema.")
else:
    print("No profile found.")

import sys
sys.path.append('.')
from core.database_manager import get_client, get_profile

client = get_client()
profile = get_profile()
if profile and "resume_data" in profile:
    resume_data = profile["resume_data"]
    if "cv" in resume_data and "sections" in resume_data["cv"] and "experience" in resume_data["cv"]["sections"]:
        for exp in resume_data["cv"]["sections"]["experience"]:
            if "date" not in exp:
                exp["date"] = "2024"
        
        # update the db
        client.table("user_profiles").update({"resume_data": resume_data}).eq("id", profile["id"]).execute()
        print("Updated user_profiles with dates in experience.")
    else:
        print("No experience section found.")
else:
    print("No profile found.")

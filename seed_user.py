import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url = os.getenv("SUPABASE_URL", "").strip()
key = os.getenv("SUPABASE_KEY", "").strip()

if not url or not key:
    print("Error: SUPABASE_URL and SUPABASE_KEY must be set in .env")
    sys.exit(1)

client: Client = create_client(url, key)

email = "aakashyaduwanshi0470@gmail.com"
password = "TestPassword123!"

print(f"Connecting to Supabase at: {url}")
print(f"Attempting to register / authenticate user: {email}")

user_id = None
try:
    # Try signing up
    res = client.auth.sign_up({
        "email": email,
        "password": password
    })
    if res.user:
        user_id = res.user.id
        print(f"Successfully signed up new user! ID: {user_id}")
except Exception as e:
    print(f"Sign up did not complete (user might already exist): {e}")

if not user_id:
    try:
        # Try signing in to get ID
        res = client.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        if res.user:
            user_id = res.user.id
            print(f"Successfully signed in! User ID: {user_id}")
    except Exception as e:
        print(f"Error signing in: {e}")

if not user_id:
    # Let's check if we can find any users or retrieve first profile
    print("Failed to authenticate test user. Please sign up a user in the Supabase Dashboard, then run update_profile.py.")
    sys.exit(1)

# Now insert user profile
resume_data = {
  "cv": {
    "name": "Akash Yaduwanshi",
    "location": "Indore, India",
    "email": "aakashyaduwanshi0470@gmail.com",
    "phone": "+91-7772074181",
    "social_networks": [
      {"network": "LinkedIn", "username": "akash-yaduwanshi"},
      {"network": "GitHub", "username": "unshakensoul17"}
    ],
    "sections": {
      "summary": [
        "Aspiring AI Engineer & Machine Learning Researcher with hands-on experience in building end-to-end intelligent systems, including NLP pipelines, transformer-based models, and real-time AI services. Specialized in representation learning, LLM integration, and scalable system design, with proven results in improving model performance and deploying production-ready AI solutions."
      ],
      "education": [
        {
          "institution": "Holkar Science College, Indore",
          "area": "Bachelor of Computer Applications (BCA)",
          "end_date": "2027",
          "highlights": ["CGPA: 8.60 / 10.0"]
        }
      ],
      "experience": [
        {
          "company": "Sentinel Flow — AI Code Intelligence System",
          "position": "Project",
          "highlights": [
            "Engineered a VS Code extension that parses and indexes codebases into interactive knowledge graphs, scaling to 50,000+ symbols with sub-second SQLite query performance.",
            "Designed a dual-path AI routing system (Groq, Gemini, Bedrock) delivering <300ms responses for quick insights and deep architectural analysis within the editor."
          ]
        }
      ],
      "skills": [
        {
          "label": "Programming",
          "details": "Python (Expert), SQL, TypeScript"
        },
        {
          "label": "AI / Machine Learning",
          "details": "PyTorch, Transformers, NLP, LLMs"
        }
      ]
    }
  }
}

tech_stack = {
    "skills": ["Python", "PyTorch", "Transformers", "FastAPI"], 
    "years_exp": 2, 
    "preferred_roles": ["AI Engineer", "Machine Learning Researcher"]
}

try:
    # Insert or update profile
    profile_data = {
        "id": user_id,
        "full_name": "Akash Yaduwanshi",
        "email": email,
        "github_url": "https://github.com/unshakensoul17",
        "linkedin_url": "https://www.linkedin.com/in/akash-yaduwanshi-902a3b352",
        "resume_data": resume_data,
        "tech_stack": tech_stack,
        "location": "Indore, Madhya Pradesh, India",
        "timezone": "Asia/Kolkata",
        "credits": 50
    }
    
    resp = client.table("user_profiles").upsert(profile_data).execute()
    print("Successfully seeded user profile in user_profiles table!")
    print(resp.data)
except Exception as e:
    print(f"Error seeding user profile: {e}")

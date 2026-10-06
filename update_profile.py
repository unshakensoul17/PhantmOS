import os
import json
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
url = os.getenv("SUPABASE_URL", "").strip()
key = os.getenv("SUPABASE_KEY", "").strip()
client: Client = create_client(url, key)

resume_data = {
  "cv": {
    "name": "Akash Yaduwanshi",
    "location": "Indore, India",
    "email": "aakashyaduwanshi0470@gmail.com",
    "phone": "+91-7772074181",
    "social_networks": [
      {
        "network": "LinkedIn",
        "username": "akash-yaduwanshi"
      },
      {
        "network": "GitHub",
        "username": "unshakensoul17"
      }
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
          "highlights": [
            "CGPA: 8.60 / 10.0"
          ]
        }
      ],
      "experience": [
        {
          "company": "Sentinel Flow — AI Code Intelligence System",
          "position": "Project",
          "highlights": [
            "Engineered a VS Code extension that parses and indexes codebases into interactive knowledge graphs, scaling to 50,000+ symbols with sub-second SQLite query performance.",
            "Designed a dual-path AI routing system (Groq, Gemini, Bedrock) delivering <300ms responses for quick insights and deep architectural analysis within the editor.",
            "Built graph-based visualizations using React and ELK.js to detect technical debt and map change impact (blast radius).",
            "Optimized AST parsing using worker-thread isolation, reducing update latency to <500ms while maintaining UI responsiveness."
          ]
        },
        {
          "company": "Inducing Compositional Reasoning via Architectural Bottlenecks",
          "position": "Project",
          "highlights": [
            "Implemented slot-based reasoning bottlenecks in small Transformers to induce compositional generalization, improving mean accuracy from ~0.55 to ~0.71 on the SCAN benchmark while keeping model size constant.",
            "Investigated the emergence of reasoning as a capacity-dependent phase transition, identifying instability across random initializations.",
            "Evaluated hybrid quantum-classical bottlenecks, demonstrating the performance impact of lack of structured inductive bias in naive quantum feature maps."
          ]
        },
        {
          "company": "AI Resume Analyzer — NLP-Based Scoring System",
          "position": "Project",
          "highlights": [
            "Developed an end-to-end ML system combining semantic embeddings with engineered features (ATS metrics, skills, experience) to produce category-wise relevance scores.",
            "Designed a multi-head attention scoring model with multi-task outputs and deployed the service via FastAPI for real-time evaluation.",
            "Implemented robust document parsing for PDF/DOCX/TXT to extract structured data for downstream analysis."
          ]
        },
        {
          "company": "SmartCart Customer Segmentation — Unsupervised ML Pipeline",
          "position": "Project",
          "highlights": [
            "Engineered a robust unsupervised pipeline identifying 4 actionable customer segments for targeted marketing insights.",
            "Applied PCA for dimensionality reduction and validated cluster quality using silhouette scores and business-focused profiling."
          ]
        }
      ],
      "skills": [
        {
          "label": "Programming",
          "details": "Python (Expert), SQL, C/C++, TypeScript"
        },
        {
          "label": "AI / Machine Learning",
          "details": "PyTorch, TensorFlow, Hugging Face Transformers, NLP, LLMs, Scikit-learn, SentenceTransformers"
        },
        {
          "label": "Systems & Deployment",
          "details": "FastAPI, Docker, Redis, PostgreSQL, SQLite, Meilisearch, Github"
        },
        {
          "label": "Data Tools",
          "details": "Pandas, NumPy, Matplotlib, Seaborn, PCA, Clustering"
        },
        {
          "label": "Other",
          "details": "Git, Linux (Mint), Github, VS Code Extension Development"
        }
      ],
      "certifications": [
        {
          "name": "Python Programming Certification — Programmers Point, Indore"
        },
        {
          "name": "Built and published multiple AI projects on GitHub; comfortable with end-to-end ML pipeline and deployment."
        }
      ]
    }
  }
}

tech_stack = {
    "skills": ["Python", "PyTorch", "Transformers", "FastAPI", "TypeScript", "React"], 
    "years_exp": 2, 
    "preferred_roles": ["AI Engineer", "Machine Learning Researcher", "Backend Engineer"]
}

# In case the table is missing the unique constraint required for standard upsert,
# we'll do an update. Or we can just insert if it's empty, or update if it exists.

try:
    # First see if we have a row
    resp = client.table("user_profiles").select("id").limit(1).execute()
    if resp.data:
        row_id = resp.data[0]["id"]
        # Update existing
        update_resp = client.table("user_profiles").update({
            "full_name": "Akash Yaduwanshi",
            "email": "aakashyaduwanshi0470@gmail.com",
            "github_url": "https://github.com/unshakensoul17",
            "linkedin_url": "https://www.linkedin.com/in/akash-yaduwanshi-902a3b352",
            "resume_data": resume_data,
            "tech_stack": tech_stack
        }).eq("id", row_id).execute()
        print("Updated existing profile in Supabase.")
    else:
        # Insert new
        insert_resp = client.table("user_profiles").insert({
            "full_name": "Akash Yaduwanshi",
            "email": "aakashyaduwanshi0470@gmail.com",
            "github_url": "https://github.com/unshakensoul17",
            "linkedin_url": "https://www.linkedin.com/in/akash-yaduwanshi-902a3b352",
            "resume_data": resume_data,
            "tech_stack": tech_stack,
            "location": "Indore, Madhya Pradesh, India",
            "timezone": "Asia/Kolkata"
        }).execute()
        print("Inserted new profile into Supabase.")
except Exception as e:
    # If the user_profiles table is from core/schema.sql (github_identifier unique)
    print("Falling back to core schema structure due to error:", e)
    
    # Check if we have github_identifier
    resp = client.table("user_profiles").select("id").eq("github_identifier", "unshakensoul17").execute()
    if resp.data:
        client.table("user_profiles").update({
            "resume_data": resume_data
        }).eq("github_identifier", "unshakensoul17").execute()
        print("Updated core schema existing profile.")
    else:
        client.table("user_profiles").insert({
            "github_identifier": "unshakensoul17",
            "resume_data": resume_data
        }).execute()
        print("Inserted core schema profile.")

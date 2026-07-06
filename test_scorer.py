import asyncio
from core.database_manager import get_client
from intelligence.scorer import run_scoring

async def main():
    client = get_client()
    # Fetch a single profile
    resp = client.table("user_profiles").select("*").limit(1).execute()
    if not resp.data:
        print("No profiles found.")
        return
        
    profile = resp.data[0]
    print(f"Testing scorer for user: {profile['email']}")
    
    # We will simulate having some 'Found' jobs. Let's just run it; if they have 0 jobs, it will say 0.
    result = await run_scoring(profile)
    print("Scoring Result:", result)

if __name__ == "__main__":
    asyncio.run(main())

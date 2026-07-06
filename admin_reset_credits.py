import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from core.database_manager import get_client
from main_orchestrator import _resolve_api_keys

def reset_credits_and_check_keys(new_credit_balance=50):
    client = get_client()
    
    print(f"Fetching all user profiles...")
    resp = client.table("user_profiles").select("*").execute()
    profiles = resp.data or []
    
    if not profiles:
        print("No users found in the database.")
        return

    print(f"Found {len(profiles)} users. Resetting credits to {new_credit_balance}...\n")
    
    for profile in profiles:
        user_id = profile.get("id")
        email = profile.get("email", "unknown_email")
        
        # 1. Update credits
        client.table("user_profiles").update({"credits": new_credit_balance}).eq("id", user_id).execute()
        
        # 2. Check for BYOK keys
        keys = _resolve_api_keys(profile)
        has_keys = bool(keys)
        
        if has_keys:
            key_names = list(keys.keys())
            print(f"✅ User: {email} | Credits reset to {new_credit_balance} | Has BYOK Keys: {key_names}")
        else:
            print(f"❌ User: {email} | Credits reset to {new_credit_balance} | NO keys found")
            
    print("\nDone! All credits have been reset.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Reset credits for all users and check BYOK keys.")
    parser.add_argument("--amount", type=int, default=50, help="Amount of credits to give each user (default: 50)")
    args = parser.parse_args()
    
    reset_credits_and_check_keys(args.amount)

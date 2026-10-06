import asyncio
import sys
import pprint
from main_orchestrator import process_pipeline
import core.database_manager

# Target user ID
USER_ID = "fe7b59b2-cb6a-42cc-a2b8-81b856d2a818"

# 1. Patch get_leads_by_status so we only pull 2 leads for scoring
# to avoid hitting rate limits or consuming too many tokens during testing.
original_get_leads_by_status = core.database_manager.get_leads_by_status

def patched_get_leads_by_status(status, limit=50, user_id=None):
    if status == "Found":
        # Force a tiny limit of 2 for scoring verification
        val = original_get_leads_by_status(status, limit=2, user_id=user_id)
        print(f"[TEST PATCH] Intercepted get_leads_by_status('Found') -> returning {len(val)} leads (original limit parameter was {limit})")
        return val
    return original_get_leads_by_status(status, limit=limit, user_id=user_id)

core.database_manager.get_leads_by_status = patched_get_leads_by_status

# 2. Patch get_leads_by_band so we only pull 2 HOT/WARM/COLD leads for tailoring
original_get_leads_by_band = core.database_manager.get_leads_by_band

def patched_get_leads_by_band(band, limit=50, user_id=None):
    val = original_get_leads_by_band(band, limit=2, user_id=user_id)
    print(f"[TEST PATCH] Intercepted get_leads_by_band('{band}') -> returning {len(val)} leads (original limit parameter was {limit})")
    return val

core.database_manager.get_leads_by_band = patched_get_leads_by_band

async def main():
    print("Starting full pipeline integration test for user fe7b59b2-cb6a-42cc-a2b8-81b856d2a818...")
    try:
        summary = await process_pipeline(target_user_id=USER_ID)
        print("\n==========================================")
        print("          PIPELINE RUN SUMMARY            ")
        print("==========================================")
        pprint.pprint(summary)
    except Exception as e:
        print("Pipeline failed with exception:", e)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())

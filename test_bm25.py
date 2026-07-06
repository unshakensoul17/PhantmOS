import asyncio
from harvesting.harvest_orchestrator import run_harvest

async def main():
    query = "python programmer"
    print(f"Testing Harvest & BM25 Filter with query: '{query}'")
    
    # Run the harvest (this now uses BM25 inside)
    jobs = await run_harvest(include_hn=False, search_query=query)
    
    print(f"\n✅ Total jobs passed BM25 pre-filter: {len(jobs)}")
    print("-" * 50)
    
    # Print the top 5 to see what passed
    for j in jobs[:5]:
        print(f"Title: {j.get('title')}")
        print(f"Company: {j.get('company')}")
        print(f"Source: {j.get('source')}")
        print("-" * 50)

if __name__ == "__main__":
    asyncio.run(main())

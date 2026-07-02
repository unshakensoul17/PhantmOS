import asyncio
import os
import sys

# Add the current directory to sys.path so modules can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from main_orchestrator import process_pipeline

async def test_search():
    query = "Python Developer"
    print(f"🚀 Starting targeted search for: '{query}'")
    
    # Run the pipeline with the specific query
    # Note: We pass a dummy target_user_id to prevent it from looping over all users if that's not needed, 
    # but the harvest discovery agent runs globally before user loops.
    await process_pipeline(manual_query=query)
    
    # Check if the file was created
    file_path = f"data/searches/jobs_{query.replace(' ', '_')}.json"
    if os.path.exists(file_path):
        print(f"\n✅ SUCCESS! Target file created at: {file_path}")
        print(f"File size: {os.path.getsize(file_path)} bytes")
    else:
        print("\n❌ Failed to find the generated JSON file. Check the logs above for API errors.")

if __name__ == "__main__":
    asyncio.run(test_search())

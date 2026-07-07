import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
key = os.getenv("GEMINI_API_KEY")

async def test():
    for model in ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro", "gemini-flash-latest"]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        payload = {"contents": [{"parts": [{"text": "Hello"}]}]}
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload)
            print(model, resp.status_code)

asyncio.run(test())

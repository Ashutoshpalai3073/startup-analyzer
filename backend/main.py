from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import uuid
import tempfile
from dotenv import load_dotenv
from agents import run_analysis
from pitch_generator import generate_pitch_deck

load_dotenv()

app = FastAPI(title="Startup Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    startup_idea: str

class PitchRequest(BaseModel):
    analysis: dict
    brand_name: str = "Your Brand"

@app.get("/")
def root():
    return {"status": "Startup Analyzer API is running"}

@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
    try:
        result = run_analysis(request.startup_idea, groq_api_key)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/download-pitch")
async def download_pitch(request: PitchRequest):
    try:
        filepath = generate_pitch_deck(request.analysis, request.brand_name)
        return FileResponse(
            filepath,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            filename=f"{request.brand_name.replace(' ', '_')}_pitch_deck.pptx",
            background=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

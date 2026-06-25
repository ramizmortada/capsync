import os
import sys
import shutil
import tempfile

# Use HuggingFace mirror to bypass regional blocks
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import whisperx
import gc
import torch

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

device = "cuda" if torch.cuda.is_available() else "cpu"
compute_type = "float16" if device == "cuda" else "int8"
print(f"Backend initialized. Device: {device}, Compute: {compute_type}", flush=True)

import requests
import json
import asyncio

download_progress = {}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "models"))

def check_downloaded_models():
    models = ["tiny", "base", "medium", "large-v2"]
    status = {}
    for m in models:
        # Check if the model directory exists and has all 4 files
        local_dir = os.path.join(MODELS_DIR, m)
        files = ["config.json", "model.bin", "vocabulary.txt", "tokenizer.json"]
        is_downloaded = all(os.path.exists(os.path.join(local_dir, f)) for f in files)
        status[m] = is_downloaded
    return status

@app.get("/api/models/status")
async def get_models_status():
    return check_downloaded_models()

@app.get("/api/models/progress/{model_name}")
async def get_download_progress(model_name: str):
    return download_progress.get(model_name, {"progress": 0, "status": "idle"})

def download_hf_model(model_size: str):
    repo = f"Systran/faster-whisper-{model_size}"
    local_dir = os.path.join(MODELS_DIR, model_size)
    os.makedirs(local_dir, exist_ok=True)
    
    files = ["config.json", "model.bin", "vocabulary.txt", "tokenizer.json"]
    base_url = f"https://hf-mirror.com/{repo}/resolve/main/"
    
    download_progress[model_size] = {"progress": 0, "status": "downloading"}
    
    total_files = len(files)
    for idx, f_name in enumerate(files):
        target_path = os.path.join(local_dir, f_name)
        if not os.path.exists(target_path):
            print(f"Downloading {f_name} from mirror...", flush=True)
            resp = requests.get(base_url + f_name, stream=True)
            resp.raise_for_status()
            total_length = resp.headers.get('content-length')
            
            if total_length is None:
                with open(target_path, "wb") as out_file:
                    out_file.write(resp.content)
            else:
                total_length = int(total_length)
                downloaded = 0
                with open(target_path, "wb") as out_file:
                    for chunk in resp.iter_content(chunk_size=8192):
                        out_file.write(chunk)
                        downloaded += len(chunk)
                        # Calculate overall progress
                        file_progress = downloaded / total_length
                        overall_progress = ((idx + file_progress) / total_files) * 100
                        download_progress[model_size]["progress"] = int(overall_progress)
    
    download_progress[model_size] = {"progress": 100, "status": "done"}
    return local_dir

@app.post("/api/transcribe")
def transcribe(
    file: UploadFile = File(...),
    model_name: str = Form("large-v2"),
    language: str = Form(None),
    max_words: int = Form(0)
):
    try:
        print(f"Received file: {file.filename}, Model: {model_name}, Lang: {language}, Max Words: {max_words}", flush=True)
        fd, temp_path = tempfile.mkstemp(suffix=os.path.splitext(file.filename)[1])
        with os.fdopen(fd, "wb") as f:
            shutil.copyfileobj(file.file, f)
        print(f"File saved to temp: {temp_path}", flush=True)

        print("Downloading WhisperX model manually from mirror...", flush=True)
        local_model_path = download_hf_model(model_name)
        print(f"Loading model from local path: {local_model_path}", flush=True)
        model = whisperx.load_model(local_model_path, device, compute_type=compute_type)
        print("Model loaded successfully!", flush=True)

        print("Loading audio file using FFmpeg...", flush=True)
        audio = whisperx.load_audio(temp_path)

        print("Audio loaded! Starting transcription...", flush=True)
        
        if language and language.strip() != "":
            result = model.transcribe(audio, batch_size=16, language=language)
            align_language = language
            result["language"] = language # Ensure it's in the final output
        else:
            result = model.transcribe(audio, batch_size=16)
            align_language = result["language"]
        
        print("Transcription finished! Loading alignment model...", flush=True)
        model_a, metadata = whisperx.load_align_model(language_code=align_language, device=device)
        print("Aligning timestamps...", flush=True)
        result = whisperx.align(result["segments"], model_a, metadata, audio, device, return_char_alignments=False)
        
        print("Process complete! Cleaning up...", flush=True)
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
        os.remove(temp_path)
        
        final_segments = result["segments"]
        if max_words > 0 or max_words == -1:
            print(f"Chunking segments (mode: {max_words})...", flush=True)
            chunked_segments = []
            for segment in final_segments:
                words = segment.get("words", [])
                if not words:
                    chunked_segments.append(segment)
                    continue
                
                if max_words == -1:
                    # Smart Mode: Dynamic Pauses
                    chunk = []
                    for i, w in enumerate(words):
                        chunk.append(w)
                        
                        word_text = w.get("word", "")
                        has_punctuation = any(p in word_text for p in [".", ",", "!", "?", ";", ":"])
                        
                        pause_after = 0
                        if i < len(words) - 1 and "end" in w and "start" in words[i+1]:
                            pause_after = words[i+1]["start"] - w["end"]
                            
                        is_too_long = len(chunk) >= 6 # Soft limit of 6 words
                        
                        if has_punctuation or pause_after > 0.3 or is_too_long or i == len(words) - 1:
                            valid_words = [cw for cw in chunk if "start" in cw and "end" in cw]
                            if valid_words:
                                text = " ".join([cw["word"] for cw in chunk])
                                chunked_segments.append({
                                    "start": valid_words[0]["start"],
                                    "end": valid_words[-1]["end"],
                                    "text": text,
                                    "words": chunk
                                })
                            chunk = []
                else:
                    # Strict chunking
                    for i in range(0, len(words), max_words):
                        chunk = words[i:i + max_words]
                        valid_words = [w for w in chunk if "start" in w and "end" in w]
                        if not valid_words:
                            continue
                        
                        text = " ".join([w["word"] for w in chunk])
                        chunked_segments.append({
                            "start": valid_words[0]["start"],
                            "end": valid_words[-1]["end"],
                            "text": text,
                            "words": chunk
                        })
            final_segments = chunked_segments

        print("Returning result to frontend.", flush=True)
        return {"language": align_language, "segments": final_segments}
    except Exception as e:
        print(f"ERROR OCCURRED: {e}", flush=True)
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

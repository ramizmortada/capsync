import os
import sys
import shutil
import tempfile

# Use HuggingFace mirror to bypass regional blocks
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

from fastapi import FastAPI, File, UploadFile, Form, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import whisperx
import gc
import torch
import subprocess
import uuid
from ass_generator import generate_ass
from font_manager import get_fonts_dir
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
current_transcription_status = "Idle"

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

@app.get("/api/transcribe/status")
async def get_transcription_status():
    return {"status": current_transcription_status}

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
    global current_transcription_status
    try:
        current_transcription_status = "Receiving media file..."
        print(f"Received file: {file.filename}, Model: {model_name}, Lang: {language}, Max Words: {max_words}", flush=True)
        fd, temp_path = tempfile.mkstemp(suffix=os.path.splitext(file.filename)[1])
        with os.fdopen(fd, "wb") as f:
            shutil.copyfileobj(file.file, f)
        print(f"File saved to temp: {temp_path}", flush=True)

        current_transcription_status = "Loading AI model..."
        print("Downloading WhisperX model manually from mirror...", flush=True)
        local_model_path = download_hf_model(model_name)
        print(f"Loading model from local path: {local_model_path}", flush=True)
        model = whisperx.load_model(local_model_path, device, compute_type=compute_type)
        print("Model loaded successfully!", flush=True)

        current_transcription_status = "Extracting audio..."
        print("Loading audio file using FFmpeg...", flush=True)
        audio = whisperx.load_audio(temp_path)

        current_transcription_status = "Transcribing audio (this may take a while)..."
        print("Audio loaded! Starting transcription...", flush=True)
        
        if language and language.strip() != "":
            result = model.transcribe(audio, batch_size=16, language=language)
            align_language = language
            result["language"] = language # Ensure it's in the final output
        else:
            result = model.transcribe(audio, batch_size=16)
            align_language = result["language"]
        
        current_transcription_status = "Loading word alignment model (may download once per language)..."
        print("Transcription finished! Loading alignment model...", flush=True)
        model_a, metadata = whisperx.load_align_model(language_code=align_language, device=device)
        current_transcription_status = "Aligning word timestamps..."
        print("Aligning timestamps...", flush=True)
        result = whisperx.align(result["segments"], model_a, metadata, audio, device, return_char_alignments=False)
        
        current_transcription_status = "Cleaning up..."
        print("Process complete! Cleaning up...", flush=True)
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
        os.remove(temp_path)
        
        final_segments = result["segments"]
        if max_words != 0:
            current_transcription_status = "Segmenting captions..."
            print(f"Chunking segments (mode: {max_words})...", flush=True)
            chunked_segments = []
            for segment in final_segments:
                words = segment.get("words", [])
                if not words:
                    chunked_segments.append(segment)
                    continue
                
                if max_words < 0:
                    # Smart Mode: Dynamic Pauses
                    soft_limit = 6 if max_words == -1 else 3
                    
                    chunk = []
                    for i, w in enumerate(words):
                        chunk.append(w)
                        
                        word_text = w.get("word", "")
                        has_punctuation = any(p in word_text for p in [".", ",", "!", "?", ";", ":"])
                        
                        pause_after = 0
                        if i < len(words) - 1 and "end" in w and "start" in words[i+1]:
                            pause_after = words[i+1]["start"] - w["end"]
                            
                        is_too_long = len(chunk) >= soft_limit
                        
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

        # Extend timestamps to eliminate gaps between segments
        if final_segments:
            for i in range(len(final_segments) - 1):
                if final_segments[i]["end"] < final_segments[i+1]["start"]:
                    final_segments[i]["end"] = final_segments[i+1]["start"]

        print("Returning result to frontend.", flush=True)
        return {
            "language": align_language, 
            "segments": final_segments,
            "raw_segments": result["segments"] # Original unchunked word-level data
        }
    except Exception as e:
        print(f"ERROR OCCURRED: {e}", flush=True)
        return {"error": str(e)}

def cleanup_files(*file_paths):
    for f in file_paths:
        try:
            if os.path.exists(f):
                os.remove(f)
        except Exception as e:
            print(f"Error cleaning up file {f}: {e}")

def get_video_duration(video_path):
    command = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", video_path
    ]
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        return float(result.stdout.strip())
    except Exception as e:
        print(f"Error getting video duration: {e}", flush=True)
        return 0.0

@app.post("/api/burn")
async def burn_subtitles(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    segments: str = Form(...),
    style: str = Form(...),
    videoWidth: int = Form(...),
    videoHeight: int = Form(...),
    cuts: str = Form(None)
):
    try:
        print(f"Received burn request for {file.filename} ({videoWidth}x{videoHeight})", flush=True)
        
        parsed_segments = json.loads(segments)
        parsed_style = json.loads(style)
        parsed_cuts = json.loads(cuts) if cuts else []
        
        # 1. Save uploaded video to temp
        unique_id = str(uuid.uuid4())
        ext = os.path.splitext(file.filename)[1]
        if not ext:
            ext = ".mp4"
            
        temp_video_path = os.path.join(tempfile.gettempdir(), f"input_{unique_id}{ext}")
        temp_ass_path = os.path.join(tempfile.gettempdir(), f"subs_{unique_id}.ass")
        output_video_path = os.path.join(tempfile.gettempdir(), f"output_{unique_id}.mp4")
        
        with open(temp_video_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        # 2. Get video duration and shift subtitle timestamps if cuts are present
        if parsed_cuts:
            total_duration = get_video_duration(temp_video_path)
            if total_duration <= 0.0:
                total_duration = max([seg["end"] for seg in parsed_segments] + [0.0])
                
            def shift_timestamp(t, cuts_list):
                total_cut_before = 0.0
                for c in cuts_list:
                    if c["end"] <= t:
                        total_cut_before += (c["end"] - c["start"])
                    elif c["start"] < t < c["end"]:
                        total_cut_before += (t - c["start"])
                return max(0.0, t - total_cut_before)
                
            # Filter out deleted words and gaps, and shift the remaining words
            clean_segments = []
            for seg in parsed_segments:
                if "words" in seg:
                    seg["words"] = [w for w in seg["words"] if not w.get("deleted") and not w.get("isGap")]
                    if not seg["words"]:
                        continue
                    seg["text"] = " ".join([w["word"] for w in seg["words"]])
                    seg["start"] = seg["words"][0]["start"]
                    seg["end"] = seg["words"][-1]["end"]
                
                seg["start"] = shift_timestamp(seg["start"], parsed_cuts)
                seg["end"] = shift_timestamp(seg["end"], parsed_cuts)
                if "words" in seg:
                    for w in seg["words"]:
                        if "start" in w:
                            w["start"] = shift_timestamp(w["start"], parsed_cuts)
                        if "end" in w:
                            w["end"] = shift_timestamp(w["end"], parsed_cuts)
                clean_segments.append(seg)
            parsed_segments = clean_segments
            
            # Generate kept ranges
            kept_ranges = []
            current_pos = 0.0
            for c in sorted(parsed_cuts, key=lambda x: x["start"]):
                if c["start"] > current_pos + 0.02:
                    kept_ranges.append((current_pos, c["start"]))
                current_pos = max(current_pos, c["end"])
            if current_pos < total_duration - 0.02:
                kept_ranges.append((current_pos, total_duration))
        else:
            # Shift timestamps (simple case, only filter out deleted/gap words but no cuts)
            clean_segments = []
            for seg in parsed_segments:
                if "words" in seg:
                    seg["words"] = [w for w in seg["words"] if not w.get("deleted") and not w.get("isGap")]
                    if not seg["words"]:
                        continue
                    seg["text"] = " ".join([w["word"] for w in seg["words"]])
                    seg["start"] = seg["words"][0]["start"]
                    seg["end"] = seg["words"][-1]["end"]
                clean_segments.append(seg)
            parsed_segments = clean_segments
            kept_ranges = []

        # 3. Generate ASS content using cleaned/shifted segments
        ass_content = generate_ass(parsed_segments, parsed_style, videoWidth, videoHeight)
        
        # 4. Save ASS file
        temp_ass_path_fwd = temp_ass_path.replace("\\", "/")
        ffmpeg_ass_path = temp_ass_path_fwd.replace(":", "\\:")

        with open(temp_ass_path, "w", encoding="utf-8") as f:
            f.write(ass_content)
            
        print(f"Generated ASS file at {temp_ass_path}", flush=True)
        
        # 5. Run FFmpeg with fontsdir
        fonts_dir = get_fonts_dir()
        temp_fonts_dir = os.path.join(tempfile.gettempdir(), f"fonts_{unique_id}")
        os.makedirs(temp_fonts_dir, exist_ok=True)
        for family_name in os.listdir(fonts_dir):
            family_path = os.path.join(fonts_dir, family_name)
            if os.path.isdir(family_path):
                for font_file in os.listdir(family_path):
                    if font_file.endswith(('.ttf', '.otf')):
                        src = os.path.join(family_path, font_file)
                        dst = os.path.join(temp_fonts_dir, font_file)
                        if not os.path.exists(dst):
                            shutil.copy2(src, dst)
        
        ffmpeg_fonts_path = temp_fonts_dir.replace("\\", "/").replace(":", "\\:")
        
        # 6. Build and execute splicing command or direct burn command
        if parsed_cuts and kept_ranges:
            filter_complex = []
            concat_inputs = ""
            for idx, (start, end) in enumerate(kept_ranges):
                filter_complex.append(f"[0:v]trim=start={start:.3f}:end={end:.3f},setpts=PTS-STARTPTS[v{idx}]")
                filter_complex.append(f"[0:a]atrim=start={start:.3f}:end={end:.3f},asetpts=PTS-STARTPTS[a{idx}]")
                concat_inputs += f"[v{idx}][a{idx}]"
            
            n = len(kept_ranges)
            filter_complex.append(f"{concat_inputs}concat=n={n}:v=1:a=1[splicedv][outa]")
            filter_complex.append(f"[splicedv]ass='{ffmpeg_ass_path}':fontsdir='{ffmpeg_fonts_path}'[outv]")
            
            filter_str = "; ".join(filter_complex)
            command = [
                "ffmpeg", "-y", "-i", temp_video_path,
                "-filter_complex", filter_str,
                "-map", "[outv]", "-map", "[outa]",
                "-c:v", "libx264", "-preset", "fast", "-crf", "18",
                "-c:a", "aac",
                output_video_path
            ]
        else:
            command = [
                "ffmpeg",
                "-y",
                "-i", temp_video_path,
                "-vf", f"ass='{ffmpeg_ass_path}':fontsdir='{ffmpeg_fonts_path}'",
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "18",
                "-c:a", "copy",
                output_video_path
            ]
        
        print(f"Running FFmpeg: {' '.join(command)}", flush=True)
        process = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if process.returncode != 0:
            print(f"FFmpeg failed: {process.stderr}", flush=True)
            raise Exception(f"FFmpeg processing failed: {process.stderr}")
            
        print("FFmpeg processing complete.", flush=True)
        
        # Schedule cleanup after response is sent
        def cleanup_fonts_dir(d):
            import shutil as _shutil
            try:
                _shutil.rmtree(d, ignore_errors=True)
            except: pass
        background_tasks.add_task(cleanup_files, temp_video_path, temp_ass_path, output_video_path)
        background_tasks.add_task(cleanup_fonts_dir, temp_fonts_dir)
        
        return FileResponse(
            output_video_path, 
            media_type="video/mp4",
            filename=f"captioned_{file.filename}"
        )
        
    except Exception as e:
        print(f"BURN ERROR: {e}", flush=True)
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

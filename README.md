# CapSync Studio

CapSync Studio is a powerful, AI-driven subtitle editor that leverages the incredible speed and accuracy of WhisperX for perfectly aligned video and audio transcription. It features a modern Next.js frontend with an interactive timeline, live preview studio, and a precise word-level subtitle editor.

## Features
- **AI Auto-Transcription**: Transcribe video or audio files rapidly using WhisperX.
- **Smart Audio-Accurate Splitting**: Split and duplicate subtitle segments perfectly synced with the underlying word-level audio timestamps.
- **Interactive Timeline**: A fully draggable, zoomable timeline that lets you manipulate your subtitles precisely.
- **Live Video Preview**: See your subtitles beautifully overlaid on your video in real-time, complete with custom text styling (fonts, strokes, and drop shadows).
- **Global Offset Control**: Nudge all your subtitles forward or backward seamlessly to fix minor sync issues.
- **Export to SRT**: Download your perfectly timed subtitles as an `.srt` file.

## Prerequisites

Before running CapSync Studio, ensure you have the following installed on your system:
1. **Node.js**: (v18 or higher)
2. **Python**: (v3.9 or higher)
3. **FFmpeg**: Must be installed and added to your system `PATH`.
4. **CUDA**: (Optional, but highly recommended) For GPU acceleration with WhisperX.

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/capsync-studio.git
   cd capsync-studio
   ```

2. **Setup the Python Backend:**
   Create a virtual environment and install dependencies.
   ```bash
   python -m venv whisperx_env
   whisperx_env\Scripts\activate  # On Windows
   cd backend
   pip install -r requirements.txt # Or install FastAPI, Uvicorn, and WhisperX manually
   ```

3. **Setup the Next.js Frontend:**
   ```bash
   cd frontend
   npm install
   ```

## Running the App (Windows)

For Windows users, simply double-click the included `start.bat` file in the root directory. This script will automatically boot up both the FastAPI backend and the Next.js frontend in separate terminal windows.

**Manual Start:**
If you prefer to start them manually:

*Start Backend:*
```bash
cd backend
..\whisperx_env\Scripts\python.exe main.py
```

*Start Frontend:*
```bash
cd frontend
npm run dev
```

Then, open your browser and navigate to `http://localhost:3000`.

## Tech Stack
- **Frontend**: Next.js, React, TailwindCSS, shadcn/ui, idb-keyval
- **Backend**: Python, FastAPI, WhisperX
- **Icons**: Lucide React

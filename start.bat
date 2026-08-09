@echo off
:: Ensure the script always runs in the correct directory
cd /d "%~dp0"

echo ===================================
echo     Starting CapSync Studio
echo ===================================

:: Add FFmpeg to PATH so WhisperX and services can process audio
set PATH=%~dp0ffmpeg\bin;%PATH%;C:\FFmpeg\bin

:: Start the Python Backend in the background (no new window)
echo Starting Python FastAPI Backend...
start /B cmd /c "cd backend && ..\whisperx_env\Scripts\python.exe main.py"

:: Start the Next.js Frontend in the background (no new window)
echo Starting Next.js Frontend...
start /B cmd /c "cd frontend && npm run dev"

echo.
echo CapSync Studio is running!
echo  - Frontend: http://localhost:3000
echo  - Backend:  http://localhost:8000
echo.
echo Keep this window open. Close this window to stop both servers.
pause > nul

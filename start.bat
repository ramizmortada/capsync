@echo off
echo ===================================
echo     Starting CapSync Studio
echo ===================================

:: Add FFmpeg to PATH so WhisperX can process audio
set PATH=%PATH%;C:\FFmpeg\bin

:: Start the Python Backend in a new terminal window
echo Starting Python FastAPI Backend...
start "CapSync Backend" cmd /k "cd backend && ..\whisperx_env\Scripts\python.exe main.py"

:: Start the Next.js Frontend in another new terminal window
echo Starting Next.js Frontend...
start "CapSync Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are booting up in separate background windows!
echo You can close this launcher window now.
pause

import { NextResponse } from 'next/server';
import { YtDlp } from 'ytdlp-nodejs';
import path from 'path';
import os from 'os';
import fs from 'fs';

export const dynamic = 'force-dynamic';

function normalizeTimestamp(timeStr?: string | number): string | null {
  if (timeStr === undefined || timeStr === null) return null;
  const trimmed = String(timeStr).trim();
  if (!trimmed) return null;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const totalSec = parseFloat(trimmed);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
  }
  return trimmed;
}

export async function POST(req: Request) {
  let tempFilePath: string | null = null;
  try {
    const { url, startTime, endTime } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }

    // 1. Download audio segment using yt-dlp
    // Removed explicit ffmpegPath so it defaults to system ffmpeg which yt-dlp requires for sections
    const PROJECT_ROOT = path.resolve(process.cwd(), '..');
    const LOCAL_FFMPEG_DIR = path.join(PROJECT_ROOT, 'ffmpeg', 'bin');
    const FFMPEG_DIR = fs.existsSync(LOCAL_FFMPEG_DIR) ? LOCAL_FFMPEG_DIR : 'C:\\FFmpeg\\bin';

    const ytdlp = new YtDlp({});

    const tempDir = os.tmpdir();
    let dl = ytdlp.download(url)
      .output(path.join(tempDir, `clip_audio_${Date.now()}_%(id)s.%(ext)s`))
      .addArgs(
        '--ffmpeg-location', FFMPEG_DIR,
        '--js-runtimes', 'node'
      );

    const normStart = normalizeTimestamp(startTime);
    const normEnd = normalizeTimestamp(endTime);

    if ((normStart || normEnd) && (normStart !== normEnd)) {
      const sectionStart = normStart || '00:00:00';
      const sectionEnd = normEnd || 'inf';
      dl = dl.addArgs('--download-sections', `*${sectionStart}-${sectionEnd}`);
    }

    dl = dl.extractAudio().audioFormat('mp3').audioQuality('0');
    
    console.log(`[clip-transcribe] Downloading audio segment... ${normStart} to ${normEnd}`);
    const result = await dl.run();
    
    if (!result.filePaths || result.filePaths.length === 0) {
      throw new Error('Failed to extract audio segment.');
    }
    
    tempFilePath = result.filePaths[0];
    console.log(`[clip-transcribe] Audio downloaded to ${tempFilePath}`);

    // 2. Post the downloaded file to the Python backend /api/transcribe
    
    // We construct a multipart/form-data request manually or using FormData.
    // NodeJS 18+ has built-in FormData
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(tempFilePath);
    const blob = new Blob([fileBuffer], { type: 'audio/mpeg' });
    formData.append('file', blob, path.basename(tempFilePath));
    formData.append('model_name', 'base'); // Use a smaller model for faster preview transcription
    formData.append('max_words', '-1'); // Smart chunking for captions

    console.log(`[clip-transcribe] Sending to backend for transcription...`);
    
    // Assuming backend runs on 8000
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const transcribeRes = await fetch(`${backendUrl}/api/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!transcribeRes.ok) {
      const errorText = await transcribeRes.text();
      throw new Error(`Backend transcription failed: ${errorText}`);
    }

    const transcriptData = await transcribeRes.json();

    // 3. Clean up the temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    return NextResponse.json(transcriptData);
  } catch (error: any) {
    console.error("[clip-transcribe] Error:", error);
    // Cleanup on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch(e) {}
    }
    return NextResponse.json({ error: error.message || 'Transcription failed' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { YtDlp } from 'ytdlp-nodejs';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

function normalizeTimestamp(timeStr?: string): string | null {
  if (!timeStr) return null;
  const trimmed = timeStr.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const totalSec = parseInt(trimmed, 10);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  const parts = trimmed.split(':');
  if (parts.length === 2) {
    const mins = parts[0].padStart(2, '0');
    const secs = parts[1].padStart(2, '0');
    return `00:${mins}:${secs}`;
  }
  if (parts.length === 3) {
    const hrs = parts[0].padStart(2, '0');
    const mins = parts[1].padStart(2, '0');
    const secs = parts[2].padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  }
  return trimmed;
}

function getVideoId(url: string): string {
  const match = url.match(/(?:v=|\/embed\/|\/1\/|\/v\/|https:\/\/youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (match && match[1]) {
    return match[1];
  }
  return url.replace(/[^a-zA-Z0-9]/g, '_').slice(-25);
}

function sanitizeFilename(name?: string): string {
  if (!name) return '';
  return name
    .replace(/[\/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

const SCRATCH_DIR = path.resolve(process.cwd(), '..', 'scratch');
const CACHE_DIR = path.join(SCRATCH_DIR, 'video_cache');
const TEMP_DIR = path.join(SCRATCH_DIR, 'temp');

export async function POST(req: Request) {
  const body = await req.json();
  const { url, isAudio, quality, type, startTime, endTime, title } = body;

  console.log(`\n========================================`);
  console.log(`[API /api/download] STARTING DOWNLOAD REQUEST`);
  console.log(`[API /api/download] URL: ${url}`);
  console.log(`[API /api/download] Title: "${title || 'N/A'}"`);
  console.log(`[API /api/download] Parameters: isAudio=${isAudio}, quality=${quality}, type=${type}`);
  console.log(`[API /api/download] Raw Time Range: startTime="${startTime}", endTime="${endTime}"`);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const ytdlp = new YtDlp({});
      const startTimeMs = Date.now();
      let isAborted = false;

      const safeEnqueue = (payload: any) => {
        if (isAborted || req.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch (e) {
          isAborted = true;
        }
      };

      try {
        if (!fs.existsSync(CACHE_DIR)) {
          fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
        if (!fs.existsSync(TEMP_DIR)) {
          fs.mkdirSync(TEMP_DIR, { recursive: true });
        }

        const videoId = getVideoId(url);
        const safeTitle = sanitizeFilename(title) || `video_${videoId}`;
        const ext = isAudio ? 'mp3' : (type || 'mp4');
        const cacheFileName = isAudio ? `${safeTitle}.${ext}` : `${safeTitle} (${quality}p).${ext}`;
        const cachedFilePath = path.join(CACHE_DIR, cacheFileName);

        const normStart = normalizeTimestamp(startTime);
        const normEnd = normalizeTimestamp(endTime);
        const hasClipping = Boolean((normStart && normStart !== '00:00:00') || (normEnd && normEnd !== '00:00:00'));

        console.log(`[API /api/download] Video Title: "${safeTitle}", Cache Key: "${cacheFileName}"`);
        console.log(`[API /api/download] Normalized Range: start="${normStart}", end="${normEnd}", Clipping Required=${hasClipping}`);

        // CHECK CACHE HIT (Exact match or fuzzy scan match)
        let foundCachedPath: string | null = null;
        if (fs.existsSync(cachedFilePath) && fs.statSync(cachedFilePath).isFile() && fs.statSync(cachedFilePath).size > 1000) {
          foundCachedPath = cachedFilePath;
        } else {
          try {
            const files = fs.readdirSync(CACHE_DIR);
            for (const f of files) {
              if (f.endsWith('.json')) continue;
              const fullP = path.join(CACHE_DIR, f);
              if (fs.statSync(fullP).isFile() && fs.statSync(fullP).size > 1000) {
                if ((videoId && f.includes(videoId)) || (safeTitle && f.includes(safeTitle))) {
                  foundCachedPath = fullP;
                  break;
                }
              }
            }
          } catch (e) {}
        }

        if (foundCachedPath && fs.existsSync(foundCachedPath)) {
          console.log(`[API /api/download] ⚡ CACHE HIT! Using existing local video file: ${foundCachedPath}`);
          safeEnqueue({ type: 'progress', data: { percentage: 50, speed: 'CACHE_HIT', downloaded_str: 'Cached', total_str: 'Cached' } });

          let finalFilePath = foundCachedPath;
          if (hasClipping) {
            const clipFileName = `${safeTitle} - Clip.${ext}`;
            const clipFilePath = path.join(TEMP_DIR, clipFileName);
            console.log(`[API /api/download] Trimming clip using local FFmpeg from cached video...`);

            const ffmpegBin = 'C:\\FFmpeg\\bin\\ffmpeg.exe';
            const ffmpegArgs = ['-y'];
            if (normStart && normStart !== '00:00:00') ffmpegArgs.push('-ss', normStart);
            if (normEnd && normEnd !== '00:00:00') ffmpegArgs.push('-to', normEnd);
            ffmpegArgs.push('-i', foundCachedPath, '-c', 'copy', '-avoid_negative_ts', 'make_zero', '-movflags', '+faststart', clipFilePath);

            console.log(`[API /api/download] Running FFmpeg: ${ffmpegBin} ${ffmpegArgs.join(' ')}`);
            await execFileAsync(ffmpegBin, ffmpegArgs);
            console.log(`[API /api/download] FFmpeg clip trimmed in ${((Date.now() - startTimeMs)/1000).toFixed(2)}s!`);
            finalFilePath = clipFilePath;
          }

          if (!isAborted && !req.signal.aborted) {
            safeEnqueue({ type: 'progress', data: { percentage: 100, speed: 'INSTANT', downloaded_str: 'Done', total_str: 'Done' } });
            safeEnqueue({ type: 'finish', file: finalFilePath });
            console.log(`[API /api/download] CACHE HIT completed in ${((Date.now() - startTimeMs)/1000).toFixed(2)}s!`);
            console.log(`========================================\n`);
            try { controller.close(); } catch (e) {}
          }
          return;
        }

        // If a directory with cachedFilePath name exists from an old run, clean it up
        if (fs.existsSync(cachedFilePath) && fs.statSync(cachedFilePath).isDirectory()) {
          try { fs.rmSync(cachedFilePath, { recursive: true, force: true }); } catch (e) {}
        }

        // CACHE MISS: Download to a clean temporary path inside TEMP_DIR to avoid yt-dlp title parsing issues
        const tempDownloadPath = path.join(TEMP_DIR, `dl_${videoId}_${quality}p_${Date.now()}.${ext}`);
        console.log(`[API /api/download] 🌐 CACHE MISS. Downloading via yt-dlp to temp path: ${tempDownloadPath}`);
        let dl = ytdlp.download(url).output(tempDownloadPath);

        req.signal.addEventListener('abort', () => {
          isAborted = true;
          console.log(`[API /api/download] Download cancelled by user.`);
          try {
            if (typeof (dl as any).abort === 'function') {
              (dl as any).abort();
            }
          } catch (e) {}
        });

        console.log(`[API /api/download] Setting FFmpeg Location: C:\\FFmpeg\\bin`);
        dl = dl.addArgs('--ffmpeg-location', 'C:\\FFmpeg\\bin');
        
        if (isAudio) {
          console.log(`[API /api/download] Format Mode: Extract Audio (mp3)`);
          dl = dl.extractAudio().audioFormat('mp3').audioQuality('0');
        } else {
          console.log(`[API /api/download] Format Mode: Video (mergevideo, quality=${quality}p, type=${type || 'mp4'})`);
          dl = dl.format({ filter: 'mergevideo', quality: `${quality}p` as any, type: type || 'mp4' });
        }

        let lastProgressLogTime = 0;
        dl.on('progress', (p) => {
          if (isAborted || req.signal.aborted) return;
          const now = Date.now();
          if (now - lastProgressLogTime > 1000 || p.percentage === 100) {
            console.log(`[API /api/download] Progress: ${p.percentage?.toFixed(1)}% | ${p.downloaded_str || '0B'} / ${p.total_str || '0B'} | Speed: ${p.speed || 'N/A'}`);
            lastProgressLogTime = now;
          }
          safeEnqueue({ type: 'progress', data: p });
        });

        console.log(`[API /api/download] Spawning yt-dlp process to populate cache...`);
        const result = await dl.run();
        const elapsedSec = ((Date.now() - startTimeMs) / 1000).toFixed(2);
        console.log(`[API /api/download] Full video cached in ${elapsedSec}s!`);

        let actualDownloadedFile: string | null = null;

        if (fs.existsSync(tempDownloadPath) && fs.statSync(tempDownloadPath).isFile() && fs.statSync(tempDownloadPath).size > 1000) {
          actualDownloadedFile = tempDownloadPath;
        } else if (result.filePaths && result.filePaths.length > 0 && fs.existsSync(result.filePaths[0]) && fs.statSync(result.filePaths[0]).isFile()) {
          actualDownloadedFile = result.filePaths[0];
        } else {
          try {
            const tempFiles = fs.readdirSync(TEMP_DIR);
            for (const f of tempFiles) {
              if (f.startsWith(`dl_${videoId}`)) {
                const fullP = path.join(TEMP_DIR, f);
                if (fs.statSync(fullP).isFile() && fs.statSync(fullP).size > 1000) {
                  actualDownloadedFile = fullP;
                  break;
                }
              }
            }
          } catch (e) {}
        }

        // Clean up stale file or directory if it exists at target cache location
        if (fs.existsSync(cachedFilePath)) {
          try { fs.rmSync(cachedFilePath, { recursive: true, force: true }); } catch (e) {}
        }

        if (actualDownloadedFile && fs.existsSync(actualDownloadedFile)) {
          console.log(`[API /api/download] Storing in video cache: ${actualDownloadedFile} -> ${cachedFilePath}`);
          try {
            fs.renameSync(actualDownloadedFile, cachedFilePath);
          } catch (e) {
            fs.copyFileSync(actualDownloadedFile, cachedFilePath);
            try { fs.unlinkSync(actualDownloadedFile); } catch (err) {}
          }

          // Write sidecar metadata file for instant thumbnails & titles
          try {
            const metaPath = cachedFilePath.replace(/\.(mp4|mkv|webm|mp3)$/i, '.meta.json');
            const metaData = {
              videoId,
              title: title || safeTitle,
              thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null,
              url,
              quality,
              isAudio
            };
            fs.writeFileSync(metaPath, JSON.stringify(metaData, null, 2));
          } catch (e) {}
        }

        let finalFilePath = cachedFilePath;

        // If clip was requested, trim from the newly cached video file
        if (hasClipping && fs.existsSync(cachedFilePath)) {
          const clipFileName = `${safeTitle} - Clip.${ext}`;
          const clipFilePath = path.join(TEMP_DIR, clipFileName);
          console.log(`[API /api/download] Trimming clip using local FFmpeg...`);

          const ffmpegBin = 'C:\\FFmpeg\\bin\\ffmpeg.exe';
          const ffmpegArgs = ['-y'];
          if (normStart && normStart !== '00:00:00') ffmpegArgs.push('-ss', normStart);
          if (normEnd && normEnd !== '00:00:00') ffmpegArgs.push('-to', normEnd);
          ffmpegArgs.push('-i', finalFilePath, '-c', 'copy', '-avoid_negative_ts', 'make_zero', '-movflags', '+faststart', clipFilePath);

          console.log(`[API /api/download] Running FFmpeg: ${ffmpegBin} ${ffmpegArgs.join(' ')}`);
          await execFileAsync(ffmpegBin, ffmpegArgs);
          finalFilePath = clipFilePath;
        }

        if (!isAborted && !req.signal.aborted) {
          console.log(`[API /api/download] Output File Path: ${finalFilePath}`);
          console.log(`========================================\n`);
          safeEnqueue({ type: 'finish', file: finalFilePath });
          try { controller.close(); } catch (e) {}
        }
      } catch (error: any) {
        if (!isAborted && !req.signal.aborted) {
          console.error(`[API /api/download] ERROR: ${error.message || error}`);
          if (error.stack) console.error(error.stack);
          console.log(`========================================\n`);
          safeEnqueue({ type: 'error', data: error.message });
          try { controller.close(); } catch (e) {}
        }
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}



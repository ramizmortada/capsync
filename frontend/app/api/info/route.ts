import { NextResponse } from 'next/server';
import { YtDlp } from 'ytdlp-nodejs';
import path from 'path';
import fs from 'fs';

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

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    const PROJECT_ROOT = path.resolve(process.cwd(), '..');
    const LOCAL_FFMPEG_BIN = path.join(PROJECT_ROOT, 'ffmpeg', 'bin', 'ffmpeg.exe');
    const FFMPEG_BIN = fs.existsSync(LOCAL_FFMPEG_BIN) ? LOCAL_FFMPEG_BIN : 'C:\\FFmpeg\\bin\\ffmpeg.exe';

    const ytdlp = new YtDlp({
      ffmpegPath: FFMPEG_BIN,
    });
    const info = await ytdlp.getInfoAsync(url, {
      rawArgs: [
        '--js-runtimes', `node:${process.execPath}`,
        '--extractor-args', 'youtube:player_client=mweb,android,web',
        '--no-check-certificates',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      ]
    } as any);
    
    // Calculate approximate sizes for each quality
    const sizes: Record<string, number> = {};
    let bestAudioSize = 0;
    
    const videoInfo = info as any;
    if (videoInfo.formats && Array.isArray(videoInfo.formats)) {
      const audioFormats = videoInfo.formats.filter((f: any) => f.acodec !== 'none' && f.vcodec === 'none');
      if (audioFormats.length > 0) {
        const bestAudio = audioFormats.reduce((prev: any, current: any) => {
          const s1 = prev.filesize || prev.filesize_approx || 0;
          const s2 = current.filesize || current.filesize_approx || 0;
          return s1 > s2 ? prev : current;
        });
        bestAudioSize = bestAudio.filesize || bestAudio.filesize_approx || 0;
      }
      
      sizes['audio'] = bestAudioSize;

      const targetHeights = [2160, 1440, 1080, 720, 480, 360];
      const videoDuration = videoInfo.duration || 0;

      for (const height of targetHeights) {
        const vFormats = videoInfo.formats.filter((f: any) => f.vcodec !== 'none' && f.height === height);
        if (vFormats.length > 0) {
          const getFmtSize = (fmt: any) => {
            if (fmt.filesize && fmt.filesize > 0) return fmt.filesize;
            if (fmt.filesize_approx && fmt.filesize_approx > 0) return fmt.filesize_approx;
            if (fmt.tbr && videoDuration > 0) return Math.round((fmt.tbr * 1024 / 8) * videoDuration);
            return 0;
          };

          const bestVideo = vFormats.reduce((prev: any, current: any) => {
            return getFmtSize(prev) >= getFmtSize(current) ? prev : current;
          });
          
          let vSize = getFmtSize(bestVideo);
          if (!vSize) {
            vSize = 10 * 1024 * 1024; // Default fallback size if unestimated
          }
          sizes[height.toString()] = vSize + bestAudioSize;
        }
      }
    }

    // Check if video is already available in Cache Storage
    let isCached = false;
    let cachedFileName: string | null = null;
    let cachedSizeMb: string | null = null;
    let cachedFilePath: string | null = null;

    if (fs.existsSync(CACHE_DIR)) {
      const videoId = getVideoId(url);
      const rawTitle = videoInfo.title || '';
      const safeTitle = sanitizeFilename(rawTitle);

      const files = fs.readdirSync(CACHE_DIR);
      for (const f of files) {
        const fullP = path.join(CACHE_DIR, f);
        if (fs.statSync(fullP).isFile() && fs.statSync(fullP).size > 1000) {
          if ((videoId && f.includes(videoId)) || (safeTitle && f.includes(safeTitle))) {
            isCached = true;
            cachedFileName = f;
            cachedFilePath = fullP;
            cachedSizeMb = (fs.statSync(fullP).size / (1024 * 1024)).toFixed(1);
            break;
          }
        }
      }
    }

    return NextResponse.json({ 
      ...info, 
      sizes, 
      isCached, 
      cachedFileName, 
      cachedFilePath, 
      cachedSizeMb 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

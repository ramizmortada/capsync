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
    const ytdlp = new YtDlp({
      ffmpegPath: path.resolve(process.cwd(), 'ffmpeg.exe'),
    });
    const info = await ytdlp.getInfoAsync(url);
    
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
      for (const height of targetHeights) {
        const vFormats = videoInfo.formats.filter((f: any) => f.vcodec !== 'none' && f.height === height);
        if (vFormats.length > 0) {
          const bestVideo = vFormats.reduce((prev: any, current: any) => {
            const s1 = prev.filesize || prev.filesize_approx || 0;
            const s2 = current.filesize || current.filesize_approx || 0;
            return s1 > s2 ? prev : current;
          });
          
          const vSize = bestVideo.filesize || bestVideo.filesize_approx || 0;
          if (vSize > 0) {
            sizes[height.toString()] = vSize + bestAudioSize;
          }
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

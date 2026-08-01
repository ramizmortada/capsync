import { NextResponse } from 'next/server';
import { YtDlp } from 'ytdlp-nodejs';
import path from 'path';

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
      // Find best audio size
      const audioFormats = videoInfo.formats.filter((f: any) => f.acodec !== 'none' && f.vcodec === 'none');
      if (audioFormats.length > 0) {
        // Sort by quality/bitrate if possible, or just size
        const bestAudio = audioFormats.reduce((prev: any, current: any) => {
          const s1 = prev.filesize || prev.filesize_approx || 0;
          const s2 = current.filesize || current.filesize_approx || 0;
          return s1 > s2 ? prev : current;
        });
        bestAudioSize = bestAudio.filesize || bestAudio.filesize_approx || 0;
      }
      
      sizes['audio'] = bestAudioSize;

      // Find video sizes per height
      const targetHeights = [2160, 1440, 1080, 720, 480, 360];
      
      for (const height of targetHeights) {
        // Get all video formats that match this height roughly (or exact)
        const vFormats = videoInfo.formats.filter((f: any) => f.vcodec !== 'none' && f.height === height);
        
        if (vFormats.length > 0) {
          // Prefer mp4/avc or best size
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

    return NextResponse.json({ ...info, sizes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

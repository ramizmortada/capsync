import { NextResponse } from 'next/server';
import { YtDlp } from 'ytdlp-nodejs';
import path from 'path';
import os from 'os';

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

export async function POST(req: Request) {
  const { url, isAudio, quality, type, startTime, endTime } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const ytdlp = new YtDlp({
        ffmpegPath: path.resolve(process.cwd(), 'ffmpeg.exe'),
      });

      try {
        // Use a safe temporary directory
        const tempDir = os.tmpdir();
        
        let dl = ytdlp.download(url).output(path.join(tempDir, '%(title)s.%(ext)s'));

        const normStart = normalizeTimestamp(startTime);
        const normEnd = normalizeTimestamp(endTime);

        if ((normStart || normEnd) && (normStart !== normEnd)) {
          const sectionStart = normStart || '00:00:00';
          const sectionEnd = normEnd || 'inf';
          if (!(sectionStart === '00:00:00' && sectionEnd === '00:00:00')) {
            dl = dl.addArgs('--download-sections', `*${sectionStart}-${sectionEnd}`);
          }
        }
        
        if (isAudio) {
          dl = dl.extractAudio().audioFormat('mp3').audioQuality('0');
        } else {
          dl = dl.format({ filter: 'mergevideo', quality: `${quality}p` as any, type: type || 'mp4' });
        }

        dl.on('progress', (p) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', data: p })}\n\n`));
        });

        const result = await dl.run();
        
        // Pass the downloaded file path to the frontend
        if (result.filePaths && result.filePaths.length > 0) {
          const finalFilePath = result.filePaths[0];
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'finish', file: finalFilePath })}\n\n`));
        } else {
          throw new Error('Download failed, no file paths returned.');
        }
        
        controller.close();
      } catch (error: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`));
        controller.close();
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


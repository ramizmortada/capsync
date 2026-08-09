import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promises as fs, existsSync } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ImageConfig {
  index: number;
  duration: number; // in seconds
}

interface SlideshowConfig {
  width: number;
  height: number;
  fitMode: 'contain' | 'cover' | 'stretch';
  transition?: 'none' | 'fade' | 'zoom' | 'slide';
  transitionDuration?: number;
  fps?: number;
  images: ImageConfig[];
}

export async function POST(req: NextRequest) {
  const tempDir = path.join(os.tmpdir(), `capsync-slideshow-${crypto.randomUUID()}`);
  
  try {
    const formData = await req.formData();
    const configStr = formData.get('config') as string;
    if (!configStr) {
      return NextResponse.json({ error: 'Missing slideshow configuration' }, { status: 400 });
    }

    const config: SlideshowConfig = JSON.parse(configStr);
    const { width, height, fitMode, images } = config;
    const fps = config.fps || 30;

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'No images specified' }, { status: 400 });
    }

    await fs.mkdir(tempDir, { recursive: true });

    // Save uploaded images to temp folder
    const inputPaths: { path: string; duration: number }[] = [];
    for (let i = 0; i < images.length; i++) {
      const file = formData.get(`image_${i}`) as File | null;
      if (!file) {
        throw new Error(`Missing image file at index ${i}`);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = path.extname(file.name) || '.png';
      const imgPath = path.join(tempDir, `img_${i}${ext}`);
      await fs.writeFile(imgPath, buffer);

      const duration = Math.max(0.5, Number(images[i].duration) || 3.0);
      inputPaths.push({ path: imgPath, duration });
    }

    // Save optional background audio file
    const audioFile = formData.get('audio') as File | null;
    let audioPath: string | null = null;
    if (audioFile && audioFile.size > 0) {
      const audioBuf = Buffer.from(await audioFile.arrayBuffer());
      const audioExt = path.extname(audioFile.name) || '.mp3';
      audioPath = path.join(tempDir, `audio${audioExt}`);
      await fs.writeFile(audioPath, audioBuf);
    }

    // Construct FFmpeg arguments
    const ffmpegArgs: string[] = ['-y'];

    // Add inputs
    inputPaths.forEach((item) => {
      ffmpegArgs.push('-loop', '1', '-t', item.duration.toString(), '-i', item.path);
    });

    if (audioPath) {
      ffmpegArgs.push('-i', audioPath);
    }

    // Build filter complex for scaling/cropping each image & concatenating
    const filterParts: string[] = [];
    const concatLabels: string[] = [];

    const transition = config.transition || 'none';
    const transitionDuration = Math.min(
      config.transitionDuration || 0.5,
      Math.min(...inputPaths.map((i) => i.duration)) / 2
    );

    inputPaths.forEach((_, idx) => {
      let scaleFilter = '';
      if (fitMode === 'cover') {
        scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
      } else if (fitMode === 'stretch') {
        scaleFilter = `scale=${width}:${height}`;
      } else {
        // contain (default)
        scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`;
      }

      filterParts.push(`[${idx}:v]${scaleFilter},setsar=1,fps=${fps}[v${idx}]`);
      concatLabels.push(`[v${idx}]`);
    });

    if (transition !== 'none' && inputPaths.length > 1 && transitionDuration > 0) {
      let currentOutputLabel = '[v0]';
      let currentOffset = inputPaths[0].duration - transitionDuration;

      const xfadeTransitionMap: Record<string, string> = {
        fade: 'fade',
        zoom: 'zoomin',
        slide: 'slideleft',
      };
      const xfadeType = xfadeTransitionMap[transition] || 'fade';

      for (let i = 1; i < inputPaths.length; i++) {
        const nextInputLabel = `[v${i}]`;
        const outLabel = i === inputPaths.length - 1 ? '[vcat]' : `[x${i}]`;

        filterParts.push(
          `${currentOutputLabel}${nextInputLabel}xfade=transition=${xfadeType}:duration=${transitionDuration}:offset=${currentOffset.toFixed(2)}${outLabel}`
        );

        currentOutputLabel = outLabel;
        if (i < inputPaths.length - 1) {
          currentOffset += inputPaths[i].duration - transitionDuration;
        }
      }
    } else {
      filterParts.push(`${concatLabels.join('')}concat=n=${inputPaths.length}:v=1:a=0[vcat]`);
    }

    ffmpegArgs.push('-filter_complex', filterParts.join(';'));
    ffmpegArgs.push('-map', '[vcat]');

    if (audioPath) {
      const audioStreamIdx = inputPaths.length;
      ffmpegArgs.push('-map', `${audioStreamIdx}:a`);
      ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
    }

    ffmpegArgs.push('-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p');

    const outputPath = path.join(tempDir, 'output.mp4');
    ffmpegArgs.push(outputPath);

    const PROJECT_ROOT = path.resolve(process.cwd(), '..');
    const LOCAL_FFMPEG_BIN = path.join(PROJECT_ROOT, 'ffmpeg', 'bin', 'ffmpeg.exe');
    const FFMPEG_BIN = existsSync(LOCAL_FFMPEG_BIN) ? LOCAL_FFMPEG_BIN : 'ffmpeg';

    // Execute FFmpeg
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(FFMPEG_BIN, ffmpegArgs);
      let stderr = '';

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });

    // Read output file into buffer
    const outputBuffer = await fs.readFile(outputPath);

    // Clean up temp directory in background
    fs.rm(tempDir, { recursive: true, force: true }).catch(console.error);

    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="slideshow.mp4"',
      },
    });

  } catch (error: any) {
    console.error('Error in render-slideshow API:', error);
    // Cleanup on error
    fs.rm(tempDir, { recursive: true, force: true }).catch(console.error);
    return NextResponse.json({ error: error.message || 'Failed to render slideshow' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filepath = searchParams.get('file');

  if (!filepath || !fs.existsSync(filepath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const stat = fs.statSync(filepath);
  const filename = path.basename(filepath);

  const fileStream = fs.createReadStream(filepath);

  // Use a ReadableStream for the response
  const stream = new ReadableStream({
    start(controller) {
      fileStream.on('data', (chunk) => controller.enqueue(chunk));
      fileStream.on('end', () => {
        controller.close();
        // Move instead of copy: Delete the temp file to prevent disk buildup
        setTimeout(() => {
          try {
            if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
          } catch (e) {
            console.error('Failed to cleanup temp file', e);
          }
        }, 1000); // 1s delay to ensure the browser fully saves it
      });
      fileStream.on('error', (err) => {
        controller.error(err);
        try { if (fs.existsSync(filepath)) fs.unlinkSync(filepath); } catch (e) {}
      });
    },
    cancel() {
      fileStream.destroy();
      try { if (fs.existsSync(filepath)) fs.unlinkSync(filepath); } catch (e) {}
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': stat.size.toString(),
    },
  });
}

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';

export async function POST(req: Request) {
  try {
    const { filepath } = await req.json();
    if (!filepath || !fs.existsSync(filepath)) {
      return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
    }

    // Windows explorer command: explorer.exe /select,"C:\path\to\file"
    const normalizedPath = filepath.replace(/\//g, '\\');
    const cmd = `explorer.exe /select,"${normalizedPath}"`;
    
    exec(cmd, (err) => {
      if (err) console.error('Failed to open location:', err);
    });

    return NextResponse.json({ success: true, filepath: normalizedPath });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

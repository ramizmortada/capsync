import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }

    const transcript = await YoutubeTranscript.fetchTranscript(url);
    
    // Format transcript into a readable string for Gemini
    let formattedTranscript = "";
    transcript.forEach((item) => {
      // offset is in milliseconds, convert to seconds
      const start = (item.offset / 1000).toFixed(2);
      const end = ((item.offset + item.duration) / 1000).toFixed(2);
      formattedTranscript += `[${start} - ${end}] ${item.text}\n`;
    });

    return NextResponse.json({ transcript: formattedTranscript });
  } catch (error: any) {
    console.error("Youtube Transcript Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to fetch transcript. The video may not have captions enabled.' }, { status: 500 });
  }
}

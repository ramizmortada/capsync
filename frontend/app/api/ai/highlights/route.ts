import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const { transcript, prompt, apiKey } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
    }
    const finalApiKey = apiKey || process.env.GEMINI_API_KEY;

    if (!finalApiKey) {
      return NextResponse.json({ error: 'No API key provided' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: finalApiKey });

    const systemInstruction = `You are a viral video editor. Your job is to extract the best, most engaging, and viral clips from the provided video transcript.
The transcript includes timestamps for the video.
You must return a JSON array of objects, where each object represents a clip.
Required JSON format:
[
  {
    "title": "Short catchy title for the clip",
    "description": "Why this is a good clip",
    "start": 15.2,
    "end": 45.5
  }
]
IMPORTANT: 
- Return ONLY the raw JSON array, with no markdown formatting or backticks.
- The 'start' and 'end' must be numbers in seconds.
- Try to find clips between 15 and 60 seconds long.
- Extract up to 6 of the best clips.`;

    const userPrompt = `${prompt || "Find the most viral, engaging, and interesting clips."}\n\nTranscript:\n${transcript}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    let text = response.text || "[]";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let clips = [];
    try {
      clips = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini", text);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    return NextResponse.json({ clips });
  } catch (error: any) {
    console.error("AI Highlights Error:", error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}

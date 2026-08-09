import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const { transcript, apiKey } = await req.json();

    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return NextResponse.json({ error: 'No valid transcript provided' }, { status: 400 });
    }

    const finalApiKey = apiKey || process.env.GEMINI_API_KEY;

    if (!finalApiKey) {
      return NextResponse.json({ error: 'No API key provided' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: finalApiKey });

    const systemInstruction = `You are a professional video editor and content creator.
Your task is to analyze the provided transcript of a video and generate a single concise, engaging, click-worthy title for the timeline/video project.
Rules:
- Title must be 3 to 7 words maximum.
- Do NOT use quotes around the title.
- Do NOT output markdown or backticks.
- Return strictly JSON with the key "title".
Example: {"title": "Mastering Fast Video Editing"}`;

    const userPrompt = `Generate a title for the following video transcript:\n\n${transcript}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    let text = response.text || "{}";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    let data = { title: "" };
    try {
      data = JSON.parse(text);
    } catch (e) {
      // If plain text was returned instead of JSON
      data = { title: text.replace(/^"|"$/g, '').trim() };
    }

    const cleanTitle = (data.title || text).replace(/^"|"$/g, '').trim();

    return NextResponse.json({ title: cleanTitle });
  } catch (error: any) {
    console.error("AI Title Generation Error:", error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}

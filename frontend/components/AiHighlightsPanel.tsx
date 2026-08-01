'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, Play, Edit3 } from 'lucide-react';
import { formatSrtTime } from '@/lib/utils';

export interface AiClip {
  title: string;
  description: string;
  start: number;
  end: number;
}

export function AiHighlightsPanel({
  transcriptText,
  onSelectClip,
  onSkip,
  videoFile
}: {
  transcriptText: string;
  onSelectClip: (clip: AiClip) => void;
  onSkip: () => void;
  videoFile: File | null;
}) {
  const [loading, setLoading] = useState(false);
  const [clips, setClips] = useState<AiClip[]>([]);
  const [prompt, setPrompt] = useState('Find the most viral, engaging, and interesting clips (between 15 to 60 seconds).');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const handleFindClips = async () => {
    if (!apiKey) {
      setError('Please provide a Gemini API key.');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptText, prompt, apiKey })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setClips(data.clips || []);
    } catch (err: any) {
      setError(err.message || 'Failed to generate clips.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto w-full max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Sparkles className="text-blue-400" /> AI Highlights</h1>
        <p className="text-zinc-400">Let Gemini analyze your video and extract the best viral moments.</p>
      </div>

      <Card className="p-4 bg-zinc-900 border-zinc-800 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Gemini API Key</label>
          <Input 
            type="password"
            placeholder="AIzaSy..." 
            value={apiKey} 
            onChange={e => setApiKey(e.target.value)} 
            className="bg-zinc-950 border-zinc-800"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Custom Prompt (Optional)</label>
          <Input 
            value={prompt} 
            onChange={e => setPrompt(e.target.value)} 
            className="bg-zinc-950 border-zinc-800"
          />
        </div>

        {error && <p className="text-red-400 text-sm font-medium">{error}</p>}

        <div className="flex gap-3 mt-2">
          <Button onClick={handleFindClips} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white flex-1">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing Video...</> : 'Generate Clips'}
          </Button>
          <Button onClick={onSkip} variant="outline" className="border-zinc-700 hover:bg-zinc-800">
            Skip to Full Editor
          </Button>
        </div>
      </Card>

      {clips.length > 0 && (
        <div className="flex flex-col gap-4 mt-4">
          <h2 className="text-xl font-bold">Suggested Clips ({clips.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clips.map((clip, i) => (
              <Card key={i} className="p-4 bg-zinc-950 border-zinc-800 flex flex-col gap-3 hover:border-blue-500/50 transition-colors cursor-pointer group">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-zinc-100 line-clamp-1">{clip.title}</h3>
                    <span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded shrink-0">
                      {formatSrtTime(clip.start).split(',')[0]} - {formatSrtTime(clip.end).split(',')[0]}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 line-clamp-2">{clip.description}</p>
                </div>
                
                <Button 
                  onClick={() => onSelectClip(clip)} 
                  className="w-full mt-auto bg-zinc-800 hover:bg-zinc-700 text-white group-hover:bg-blue-600 group-hover:text-white transition-colors"
                >
                  <Edit3 className="w-4 h-4 mr-2" /> Edit This Clip
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

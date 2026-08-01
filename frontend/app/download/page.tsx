'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { set } from 'idb-keyval';
import Downloader from '@/components/Downloader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';

interface AiClip {
  title: string;
  description: string;
  start: number;
  end: number;
}

export default function DownloadPage() {
  const router = useRouter();
  
  // State from the main Downloader
  const [videoUrl, setVideoUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<any>(null);

  // AI State
  const [loadingClips, setLoadingClips] = useState(false);
  const [clips, setClips] = useState<AiClip[]>([]);
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('Find the most viral, engaging, and interesting clips (between 15 to 60 seconds).');

  const handleMainDownloadComplete = async (downloadedFile: File, action: 'download' | 'download_and_edit') => {
    if (action === 'download_and_edit') {
      try {
        await set('capsync_project', {
          file: downloadedFile,
          status: 'idle',
          result: null,
          editableSegments: []
        });
        router.push('/editor');
      } catch (err) {
        console.error('Failed to save file', err);
        alert('Failed to save video to local storage.');
      }
    }
  };

  const handleFindClips = async () => {
    if (!videoUrl) return;
    setLoadingClips(true);
    setError('');
    
    try {
      // 1. Fetch transcript from YouTube
      const transcriptRes = await fetch('/api/youtube-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl })
      });
      
      const transcriptData = await transcriptRes.json();
      if (transcriptData.error) throw new Error(transcriptData.error);

      // 2. Feed transcript to Gemini
      const aiRes = await fetch('/api/ai/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcript: transcriptData.transcript, 
          prompt 
        })
      });
      
      const aiData = await aiRes.json();
      if (aiData.error) throw new Error(aiData.error);
      
      setClips(aiData.clips || []);
    } catch (err: any) {
      setError(err.message || 'Failed to generate clips.');
    } finally {
      setLoadingClips(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center p-8 overflow-y-auto h-screen bg-neutral-950">
      
      {/* Main Downloader */}
      <div className="w-full max-w-4xl flex flex-col gap-6 mb-8 mt-8">
        <Downloader 
          onDownloadComplete={handleMainDownloadComplete} 
          onInfoFetched={(url, info) => {
            setVideoUrl(url);
            setVideoInfo(info);
          }}
        />

        {videoInfo && (
          <Card className="p-6 bg-zinc-900 border-zinc-800 shadow-xl flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <Sparkles className="text-amber-400 w-6 h-6" /> 
                AI Clip Generator
              </h2>
              <p className="text-sm text-zinc-400">Find the best viral moments before downloading the whole video.</p>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-zinc-300">Custom Prompt (Optional)</label>
              <textarea 
                value={prompt} 
                onChange={e => setPrompt(e.target.value)} 
                rows={3}
                className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 resize-none shadow-inner"
                placeholder="Describe what kind of clips you want to extract..."
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-lg text-sm font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button 
              onClick={handleFindClips} 
              disabled={loadingClips} 
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold h-12 text-base transition-colors rounded-xl shadow-lg shadow-amber-500/20"
            >
              {loadingClips ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analyzing Transcript...</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" /> Find Viral Clips</>
              )}
            </Button>
          </Card>
        )}
      </div>

      {/* AI Highlights Section Grid */}
      {videoInfo && clips.length > 0 && (
        <div className="w-full max-w-4xl flex flex-col gap-8 pb-20">
          <div className="w-full h-px bg-zinc-800 my-4" />
          

            <div className="flex flex-col gap-6 mt-8">
              <h3 className="text-2xl font-bold text-white">Suggested Clips ({clips.length})</h3>
              <div className="flex flex-col gap-8">
                {clips.map((clip, i) => (
                  <div key={i} className="flex flex-col gap-4">
                    {/* Clip Metadata */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2 shadow-lg">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-lg text-white line-clamp-1">{clip.title}</h4>
                        <span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-2 py-1 rounded shrink-0 border border-zinc-700">
                          {clip.start}s - {clip.end}s
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 line-clamp-3">{clip.description}</p>
                    </div>
                    
                    {/* Pre-filled Downloader for this specific clip */}
                    <Downloader
                      compact={true}
                      initialUrl={videoUrl}
                      initialInfo={videoInfo}
                      initialStartTime={clip.start}
                      initialEndTime={clip.end}
                      clipTitle={clip.title}
                      onDownloadComplete={handleMainDownloadComplete}
                    />
                  </div>
                ))}
              </div>
            </div>
        </div>
      )}
    </div>
  );
}

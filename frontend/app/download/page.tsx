'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { set } from 'idb-keyval';
import Downloader from '@/components/Downloader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Sparkles, Loader2, AlertCircle, X, Search, ArrowRight } from 'lucide-react';

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
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('Find the most viral, engaging, and interesting clips (between 15 to 60 seconds).');

  const [loadingInfo, setLoadingInfo] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Load saved clips on mount
  useEffect(() => {
    const saved = localStorage.getItem('capsync_suggested_clips');
    let loadedFromClips = false;
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.clips && data.videoInfo && data.videoUrl) {
          setClips(data.clips);
          setVideoInfo(data.videoInfo);
          setVideoUrl(data.videoUrl);
          setUrlInput(data.videoUrl);
          loadedFromClips = true;
        }
      } catch (e) {}
    }
    
    if (!loadedFromClips) {
      const savedUrl = localStorage.getItem('ytUrl');
      const savedInfo = localStorage.getItem('ytInfo');
      if (savedUrl) {
        setUrlInput(savedUrl);
        setVideoUrl(savedUrl);
      }
      if (savedInfo) {
        try {
          setVideoInfo(JSON.parse(savedInfo));
        } catch (e) {}
      }
    }
    setIsLoaded(true);
  }, []);

  // Save clips when they change
  useEffect(() => {
    if (isLoaded) {
      if (clips.length > 0 && videoInfo && videoUrl) {
        localStorage.setItem('capsync_suggested_clips', JSON.stringify({
          clips, videoInfo, videoUrl
        }));
      } else if (clips.length === 0) {
        localStorage.removeItem('capsync_suggested_clips');
      }
    }
  }, [clips, videoInfo, videoUrl, isLoaded]);

  const fetchInfo = async () => {
    if (!urlInput) return;
    setLoadingInfo(true);
    setError('');
    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      if (urlInput !== videoUrl) {
        setClips([]);
      }
      
      setVideoInfo(data);
      setVideoUrl(urlInput);
      
      localStorage.setItem('ytUrl', urlInput);
      localStorage.setItem('ytInfo', JSON.stringify(data));
    } catch (err: any) {
      alert('Failed to fetch info. Check URL or verify yt-dlp works.');
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleRemoveClip = (index: number) => {
    setClips(prev => prev.filter((_, i) => i !== index));
  };

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
    } else if (action === 'download') {
      // Trigger native browser download
      const url = URL.createObjectURL(downloadedFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadedFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
      
      {/* Search Section */}
      <div className="w-full max-w-4xl flex flex-col gap-6 mb-8 mt-8">
        <div className="relative flex items-center shrink-0 w-full max-w-4xl mx-auto">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-zinc-500" />
          </div>
          <Input 
            placeholder="Paste YouTube URL here..." 
            value={urlInput} 
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrlInput(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && fetchInfo()}
            className="h-11 text-sm pl-10 pr-16 rounded-full bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-zinc-500 transition-all shadow-sm w-full"
          />
          <Button 
            onClick={fetchInfo} 
            disabled={loadingInfo || !urlInput} 
            size="icon"
            className="absolute right-1.5 inset-y-1.5 my-auto h-8 w-8 rounded-full bg-white text-black hover:bg-zinc-200 active:translate-y-0 active:scale-100 transition-none flex items-center justify-center shadow-md disabled:opacity-50"
          >
            {loadingInfo ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>

        {/* Main Downloader */}
        {videoInfo && (
          <Downloader 
            url={videoUrl}
            info={videoInfo}
            onDownloadComplete={handleMainDownloadComplete} 
          />
        )}

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
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-2 py-1 rounded shrink-0 border border-zinc-700">
                            {clip.start}s - {clip.end}s
                          </span>
                          <button 
                            onClick={() => handleRemoveClip(i)}
                            className="text-zinc-500 hover:text-red-400 bg-zinc-800 hover:bg-zinc-700 p-1 rounded transition-colors"
                            title="Remove clip"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-400 line-clamp-3">{clip.description}</p>
                    </div>
                    
                    {/* Pre-filled Downloader for this specific clip */}
                    <Downloader
                      url={videoUrl}
                      info={videoInfo}
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

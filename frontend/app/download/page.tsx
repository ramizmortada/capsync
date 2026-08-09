'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { set } from 'idb-keyval';
import Downloader from '@/components/Downloader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  X, 
  Search, 
  Plus, 
  Trash2, 
  Video, 
  CheckCircle2, 
  LayoutGrid,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  RotateCw
} from 'lucide-react';

interface AiClip {
  title: string;
  description: string;
  start: number;
  end: number;
}

interface VideoCardData {
  id: string;
  url: string;
  info: any;
  clips?: AiClip[];
  prompt?: string;
  loadingClips?: boolean;
  refetchingInfo?: boolean;
  error?: string;
}

function UrlActionRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
        title="Copy URL to clipboard"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleOpenNewTab}
        className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors shrink-0"
        title="Open link in new tab"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

export default function DownloadPage() {
  const router = useRouter();
  
  const [cards, setCards] = useState<VideoCardData[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved video cards on mount & re-verify cache status
  useEffect(() => {
    const savedCards = localStorage.getItem('capsync_active_video_cards');
    let loaded = false;

    if (savedCards) {
      try {
        const parsed: VideoCardData[] = JSON.parse(savedCards);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCards(parsed);
          loaded = true;

          // Asynchronously verify cache status for each active video card
          parsed.forEach(async (card) => {
            try {
              const res = await fetch('/api/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: card.url })
              });
              const data = await res.json();
              if (!data.error) {
                setCards(prev => prev.map(c => c.id === card.id ? { ...c, info: { ...c.info, ...data } } : c));
              }
            } catch (e) {}
          });
        }
      } catch (e) {}
    }

    // Fallback: migrate legacy single video if no multi-cards saved
    if (!loaded) {
      const savedUrl = localStorage.getItem('ytUrl');
      const savedInfo = localStorage.getItem('ytInfo');
      if (savedUrl && savedInfo) {
        try {
          const parsedInfo = JSON.parse(savedInfo);
          setCards([{
            id: Date.now().toString(),
            url: savedUrl,
            info: parsedInfo,
            prompt: 'Find the most viral, engaging, and interesting clips (between 15 to 60 seconds).'
          }]);
        } catch (e) {}
      }
    }
    setIsLoaded(true);
  }, []);

  // Save active video cards to localStorage
  useEffect(() => {
    if (isLoaded) {
      if (cards.length > 0) {
        localStorage.setItem('capsync_active_video_cards', JSON.stringify(cards.map(c => ({
          id: c.id,
          url: c.url,
          info: c.info,
          clips: c.clips,
          prompt: c.prompt
        }))));
      } else {
        localStorage.removeItem('capsync_active_video_cards');
      }
    }
  }, [cards, isLoaded]);

  const handleCardCacheStatusChange = (cardId: string, isCached: boolean, cachedFilePath?: string) => {
    setCards(prev => prev.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          info: {
            ...c.info,
            isCached,
            cachedFilePath: cachedFilePath || c.info?.cachedFilePath
          }
        };
      }
      return c;
    }));
  };

  const handleAddVideo = async () => {
    if (!urlInput.trim()) return;
    setLoadingInfo(true);

    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const newUrl = urlInput.trim();
      
      // Check if video URL is already present
      const existing = cards.find(c => c.url === newUrl);
      if (existing) {
        // Scroll to existing card
        const el = document.getElementById(`video-card-${existing.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        setUrlInput('');
        return;
      }

      const newCard: VideoCardData = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        url: newUrl,
        info: data,
        prompt: 'Find the most viral, engaging, and interesting clips (between 15 to 60 seconds).'
      };

      setCards(prev => [newCard, ...prev]);
      setUrlInput('');
      
      // Also update single legacy keys for backwards compatibility
      localStorage.setItem('ytUrl', newUrl);
      localStorage.setItem('ytInfo', JSON.stringify(data));
    } catch (err: any) {
      alert(err.message || 'Failed to fetch video info. Verify YouTube URL.');
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleRemoveCard = (cardId: string) => {
    setCards(prev => prev.filter(c => c.id !== cardId));
  };

  const handleRefetchCard = async (cardId: string, url: string) => {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, refetchingInfo: true } : c));

    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setCards(prev => prev.map(c => c.id === cardId ? { ...c, info: data, refetchingInfo: false } : c));
    } catch (err: any) {
      alert(err.message || 'Failed to refetch video info.');
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, refetchingInfo: false } : c));
    }
  };

  const handleClearAllCards = () => {
    if (confirm('Are you sure you want to remove all open video downloader cards?')) {
      setCards([]);
      localStorage.removeItem('capsync_active_video_cards');
    }
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

  const handleFindClips = async (cardId: string) => {
    const targetCard = cards.find(c => c.id === cardId);
    if (!targetCard) return;

    setCards(prev => prev.map(c => c.id === cardId ? { ...c, loadingClips: true, error: '' } : c));

    try {
      const transcriptRes = await fetch('/api/youtube-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetCard.url })
      });
      
      const transcriptData = await transcriptRes.json();
      if (transcriptData.error) throw new Error(transcriptData.error);

      const aiRes = await fetch('/api/ai/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transcript: transcriptData.transcript, 
          prompt: targetCard.prompt || 'Find the most viral, engaging, and interesting clips (between 15 to 60 seconds).' 
        })
      });
      
      const aiData = await aiRes.json();
      if (aiData.error) throw new Error(aiData.error);
      
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, clips: aiData.clips || [], loadingClips: false } : c));
    } catch (err: any) {
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, error: err.message || 'Failed to generate clips.', loadingClips: false } : c));
    }
  };

  const handleRemoveClip = (cardId: string, clipIndex: number) => {
    setCards(prev => prev.map(c => {
      if (c.id === cardId && c.clips) {
        return { ...c, clips: c.clips.filter((_, i) => i !== clipIndex) };
      }
      return c;
    }));
  };

  const updateCardPrompt = (cardId: string, prompt: string) => {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, prompt } : c));
  };

  return (
    <div className="flex-1 flex flex-col items-center p-8 overflow-y-auto h-screen bg-neutral-950 text-white">
      
      {/* Top Search / Add Video Bar */}
      <div className="w-full max-w-4xl flex flex-col gap-4 mb-8 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold tracking-tight">Downloader Workspace</h1>
          </div>

          {cards.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {cards.length} Active Video{cards.length > 1 ? 's' : ''}
              </span>
              <Button
                onClick={handleClearAllCards}
                size="sm"
                variant="ghost"
                className="text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Clear Workspace
              </Button>
            </div>
          )}
        </div>

        <div className="relative flex items-center shrink-0 w-full">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-zinc-500" />
          </div>
          <Input 
            placeholder="Paste YouTube URL here and press Enter to add video..." 
            value={urlInput} 
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrlInput(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleAddVideo()}
            className="h-12 text-sm pl-10 pr-28 rounded-full bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-zinc-500 transition-all shadow-sm w-full"
          />
          <Button 
            onClick={handleAddVideo} 
            disabled={loadingInfo || !urlInput.trim()} 
            size="sm"
            className="absolute right-1.5 inset-y-1.5 my-auto h-9 px-4 rounded-full bg-white text-black hover:bg-zinc-200 active:translate-y-0 transition-none flex items-center gap-1.5 font-bold shadow-md disabled:opacity-50"
          >
            {loadingInfo ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add Video</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Video Cards Grid / Stack */}
      <div className="w-full max-w-4xl flex flex-col gap-12 pb-24">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-center gap-4 my-8">
            <div className="p-4 bg-zinc-800/50 rounded-full text-zinc-500">
              <LayoutGrid className="w-10 h-10" />
            </div>
            <div className="flex flex-col gap-1 max-w-md">
              <h3 className="text-lg font-bold text-zinc-200">No Open Videos</h3>
              <p className="text-sm text-zinc-500">
                Paste any YouTube link in the search bar above and click <span className="text-zinc-300 font-medium">+ Add Video</span> to open a video card. You can keep multiple video downloader cards open simultaneously.
              </p>
            </div>
          </div>
        ) : (
          cards.map((card, cardIndex) => (
            <div 
              key={card.id} 
              id={`video-card-${card.id}`}
              className="flex flex-col gap-6 p-6 bg-zinc-900/60 border border-zinc-800/90 rounded-2xl shadow-xl relative"
            >
              {/* Card Top Control Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 gap-4">
                <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800 text-xs font-mono font-bold text-zinc-300 shrink-0">
                    #{cardIndex + 1}
                  </div>
                  <div className="flex flex-col overflow-hidden min-w-0">
                    <h2 className="font-bold text-base text-white truncate" title={card.info?.title || card.url}>
                      {card.info?.title || 'YouTube Video'}
                    </h2>
                    {card.info?.channel || card.info?.uploader ? (
                      <span className="text-xs text-zinc-400 font-medium truncate mt-0.5">
                        {card.info.channel || card.info.uploader}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <UrlActionRow url={card.url} />
                  
                  <button
                    type="button"
                    onClick={() => handleRefetchCard(card.id, card.url)}
                    disabled={card.refetchingInfo}
                    className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-blue-400 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                    title="Refetch video info & resolutions"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${card.refetchingInfo ? 'animate-spin text-blue-400' : ''}`} />
                  </button>

                  <Button
                    onClick={() => handleRemoveCard(card.id)}
                    size="sm"
                    variant="ghost"
                    className="h-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg gap-1.5 transition-colors shrink-0"
                    title="Remove video card"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-xs font-semibold">Remove</span>
                  </Button>
                </div>
              </div>

              {/* Main Downloader for this specific video card */}
              <Downloader 
                url={card.url}
                info={card.info}
                onDownloadComplete={handleMainDownloadComplete} 
                onCacheStatusChange={(isCached, cachedPath) => handleCardCacheStatusChange(card.id, isCached, cachedPath)}
              />

              {/* AI Clip Generator Section for this specific video card */}
              <Card className="p-6 bg-zinc-900 border-zinc-800 shadow-lg flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                    <Sparkles className="text-amber-400 w-5 h-5" /> 
                    AI Clip Generator
                  </h3>
                  <p className="text-xs text-zinc-400">Extract viral highlights from this video transcript.</p>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Custom Prompt (Optional)</label>
                  <textarea 
                    value={card.prompt || ''} 
                    onChange={e => updateCardPrompt(card.id, e.target.value)} 
                    rows={2}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 resize-none shadow-inner"
                    placeholder="Describe what kind of clips you want to extract..."
                  />
                </div>

                {card.error && (
                  <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-lg text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {card.error}
                  </div>
                )}

                <Button 
                  onClick={() => handleFindClips(card.id)} 
                  disabled={card.loadingClips} 
                  className="bg-amber-500 hover:bg-amber-600 text-black font-bold h-11 text-sm transition-colors rounded-xl shadow-lg shadow-amber-500/20"
                >
                  {card.loadingClips ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing Transcript...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Find Viral Clips</>
                  )}
                </Button>
              </Card>

              {/* AI Suggested Clips for this card */}
              {card.clips && card.clips.length > 0 && (
                <div className="flex flex-col gap-6 mt-4 pt-4 border-t border-zinc-800">
                  <h4 className="text-xl font-bold text-white flex items-center gap-2">
                    <Sparkles className="text-amber-400 w-5 h-5" />
                    Suggested Clips ({card.clips.length})
                  </h4>
                  <div className="flex flex-col gap-6">
                    {card.clips.map((clip, i) => (
                      <div key={i} className="flex flex-col gap-3">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2 shadow-lg">
                          <div className="flex justify-between items-start">
                            <h5 className="font-bold text-base text-white line-clamp-1">{clip.title}</h5>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-2 py-1 rounded shrink-0 border border-zinc-700">
                                {clip.start}s - {clip.end}s
                              </span>
                              <button 
                                onClick={() => handleRemoveClip(card.id, i)}
                                className="text-zinc-500 hover:text-red-400 bg-zinc-800 hover:bg-zinc-700 p-1 rounded transition-colors"
                                title="Remove clip"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-400 line-clamp-2">{clip.description}</p>
                        </div>
                        
                        <Downloader
                          url={card.url}
                          info={card.info}
                          initialStartTime={clip.start}
                          initialEndTime={clip.end}
                          clipTitle={clip.title}
                          onDownloadComplete={handleMainDownloadComplete}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

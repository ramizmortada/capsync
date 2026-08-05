'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Search, Music, Video, Loader2, Download, CheckCircle2, ArrowRight, Scissors, AlertCircle, Repeat, HardDrive, Folder } from 'lucide-react';
import TimeSegmentPicker, { TimeValue } from './TimeSegmentPicker';
import YouTubePreviewPlayer from './YouTubePreviewPlayer';

const timeValueToSeconds = (val: TimeValue): number => {
  const h = parseInt(val.hours || '0', 10);
  const m = parseInt(val.minutes || '0', 10);
  const s = parseInt(val.seconds || '0', 10);
  return h * 3600 + m * 60 + s;
};

const formatSecondsToHHMMSS = (totalSeconds: number): string => {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatDurationBadge = (totalSec: number): string => {
  if (totalSec <= 0) return '0s';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  if (m > 0) {
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }
  return `${s}s`;
};

export interface DownloaderProps {
  onDownloadComplete?: (file: File, action: 'download' | 'download_and_edit') => void;
  onCacheStatusChange?: (isCached: boolean, cachedFilePath?: string) => void;
  url: string;
  info: any;
  initialStartTime?: number;
  initialEndTime?: number;
  clipTitle?: string;
  children?: React.ReactNode;
}

const secondsToTimeValue = (totalSeconds: number): TimeValue => {
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return { hours, minutes, seconds };
};

export default function Downloader({ 
  onDownloadComplete,
  onCacheStatusChange,
  url,
  info,
  initialStartTime,
  initialEndTime,
  clipTitle,
  children
}: DownloaderProps) {
  const [loading, setLoading] = useState(false);
  const [isAudio, setIsAudio] = useState(false);
  const [quality, setQuality] = useState('1080');
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCached, setIsCached] = useState<boolean>(Boolean(info?.isCached));
  const [cachedFileName, setCachedFileName] = useState<string | null>(info?.cachedFileName || null);
  const [cachedFilePath, setCachedFilePath] = useState<string | null>(info?.cachedFilePath || null);
  const [cachedSizeMb, setCachedSizeMb] = useState<string | null>(info?.cachedSizeMb || null);

  useEffect(() => {
    if (info) {
      setIsCached(Boolean(info.isCached));
      setCachedFileName(info.cachedFileName || null);
      setCachedFilePath(info.cachedFilePath || null);
      setCachedSizeMb(info.cachedSizeMb || null);
    }
  }, [info]);

  const [statusText, setStatusText] = useState('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [downloadAction, setDownloadAction] = useState<'download' | 'download_and_edit'>('download');

  const isMountedRef = useRef(false);

  // Time segment values initialized directly from localStorage if present
  const [startValue, setStartValue] = useState<TimeValue>(() => {
    if (initialStartTime !== undefined) return secondsToTimeValue(initialStartTime);
    if (typeof window !== 'undefined' && url) {
      const savedSegment = localStorage.getItem(`capsync_segment_${url}`);
      if (savedSegment) {
        try {
          const parsed = JSON.parse(savedSegment);
          if (parsed.startValue) return parsed.startValue;
        } catch (e) {}
      }
    }
    return { hours: '00', minutes: '00', seconds: '00' };
  });

  const [endValue, setEndValue] = useState<TimeValue>(() => {
    if (initialEndTime !== undefined) return secondsToTimeValue(initialEndTime);
    if (typeof window !== 'undefined' && url) {
      const savedSegment = localStorage.getItem(`capsync_segment_${url}`);
      if (savedSegment) {
        try {
          const parsed = JSON.parse(savedSegment);
          if (parsed.endValue) return parsed.endValue;
        } catch (e) {}
      }
    }
    return { hours: '00', minutes: '00', seconds: '00' };
  });

  const [isLoopingClip, setIsLoopingClip] = useState(false);

  // Re-sync state when URL changes
  useEffect(() => {
    if (url && initialStartTime === undefined && initialEndTime === undefined) {
      const savedSegment = localStorage.getItem(`capsync_segment_${url}`);
      if (savedSegment) {
        try {
          const parsed = JSON.parse(savedSegment);
          if (parsed.startValue) setStartValue(parsed.startValue);
          if (parsed.endValue) setEndValue(parsed.endValue);
        } catch (e) {}
      }
    }
    isMountedRef.current = true;
  }, [url, initialStartTime, initialEndTime]);

  // Persist segment times to localStorage ONLY when modified after mount
  useEffect(() => {
    if (isMountedRef.current && url && initialStartTime === undefined && initialEndTime === undefined) {
      localStorage.setItem(`capsync_segment_${url}`, JSON.stringify({
        startValue,
        endValue
      }));
    }
  }, [url, startValue, endValue, initialStartTime, initialEndTime]);

  // Calculate clipping state and validation
  const startSeconds = timeValueToSeconds(startValue);
  const endSeconds = timeValueToSeconds(endValue);
  const totalDuration = typeof info?.duration === 'number' ? info.duration : null;

  // Clipping is active if start > 0 OR end is set below total duration
  const isClipping = startSeconds > 0 || (totalDuration !== null ? (endSeconds > 0 && endSeconds < totalDuration) : endSeconds > 0);

  let clippingError: string | null = null;
  let isStartInvalid = false;
  let isEndInvalid = false;

  if (isClipping) {
    if (totalDuration !== null && startSeconds >= totalDuration) {
      clippingError = `Start time cannot exceed video duration (${formatSecondsToHHMMSS(totalDuration)})`;
      isStartInvalid = true;
    } else if (totalDuration !== null && endSeconds > totalDuration) {
      clippingError = `End time (${formatSecondsToHHMMSS(endSeconds)}) exceeds video duration (${formatSecondsToHHMMSS(totalDuration)})`;
      isEndInvalid = true;
    } else if (endSeconds > 0 && startSeconds >= endSeconds) {
      clippingError = `Start time must be earlier than End time`;
      isStartInvalid = true;
      isEndInvalid = true;
    }
  }

  const loopRange = (isLoopingClip && !clippingError && endSeconds > startSeconds)
    ? { start: startSeconds, end: endSeconds }
    : null;

  // Pre-fill end time (if not saved) and auto-select highest available quality option
  useEffect(() => {
    if (info) {
      const savedSegment = url ? localStorage.getItem(`capsync_segment_${url}`) : null;
      if (info.duration && typeof info.duration === 'number' && initialEndTime === undefined && !savedSegment) {
        const hrs = Math.floor(info.duration / 3600);
        const mins = Math.floor((info.duration % 3600) / 60);
        const secs = Math.floor(info.duration % 60);
        setEndValue({
          hours: hrs.toString().padStart(2, '0'),
          minutes: mins.toString().padStart(2, '0'),
          seconds: secs.toString().padStart(2, '0'),
        });
      }

      if (info.sizes) {
        const availableQualities = ['2160', '1440', '1080', '720', '480', '360'].filter(
          (q) => Boolean(info.sizes[q])
        );
        if (availableQualities.length > 0 && !info.sizes[quality]) {
          setQuality(availableQualities[0]);
        }
      }
    }
  }, [info, url, initialEndTime]);

  const handleResetClipping = () => {
    setIsLoopingClip(false);
    setStartValue({ hours: '00', minutes: '00', seconds: '00' });
    if (url) {
      localStorage.removeItem(`capsync_segment_${url}`);
    }
    if (info?.duration && typeof info.duration === 'number') {
      const hrs = Math.floor(info.duration / 3600);
      const mins = Math.floor((info.duration % 3600) / 60);
      const secs = Math.floor(info.duration % 60);
      setEndValue({
        hours: hrs.toString().padStart(2, '0'),
        minutes: mins.toString().padStart(2, '0'),
        seconds: secs.toString().padStart(2, '0'),
      });
    } else {
      setEndValue({ hours: '00', minutes: '00', seconds: '00' });
    }
  };

  const handleSetStartFromPlayer = (val: TimeValue) => {
    setStartValue(val);
  };

  const handleSetEndFromPlayer = (val: TimeValue) => {
    setEndValue(val);
  };



  const handleCancel = () => {
    if (abortController) {
      try {
        abortController.abort();
      } catch (e) {
        // Ignore any abort error
      }
      setAbortController(null);
    }
    setDownloading(false);
    setProgress(0);
    setStatusText('Cancelled');
  };

  const startDownload = async (action: 'download' | 'download_and_edit' = 'download') => {
    if (downloading) {
      handleCancel();
      return;
    }

    setDownloadAction(action);
    const controller = new AbortController();
    setAbortController(controller);

    setDownloading(true);
    setProgress(0);
    setStatusText(isClipping ? 'Extracting video clip from YouTube...' : 'Starting download to server...');

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          isAudio,
          quality,
          type: 'mp4',
          title: info?.title,
          startTime: isClipping ? `${startValue.hours}:${startValue.minutes}:${startValue.seconds}` : undefined,
          endTime: isClipping ? `${endValue.hours}:${endValue.minutes}:${endValue.seconds}` : undefined,
        }),
        signal: controller.signal
      });

      if (!res.body) throw new Error('ReadableStream not yet supported in this browser.');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            try {
              const event = JSON.parse(dataStr);
              if (event.type === 'progress') {
                setProgress(event.data.percentage ?? 0);
                
                let trackType = 'stream';
                if (event.data.filename) {
                  const ext = event.data.filename.split('.').pop();
                  if (ext) trackType = ext.toUpperCase() + ' track';
                }
                
                setStatusText(`Downloading ${trackType}...`);
              } else if (event.type === 'finish') {
                setDownloading(false);
                setProgress(100);
                setStatusText('Download Complete! Prompting save dialog...');
                setIsCached(true);
                setCachedFilePath(event.file);
                if (onCacheStatusChange) onCacheStatusChange(true, event.file);
                
                const fileRes = await fetch('/api/serve?file=' + encodeURIComponent(event.file));
                const blob = await fileRes.blob();
                const fileName = event.file.split(/[/\\]/).pop() || 'video.mp4';
                const downloadedFile = new File([blob], fileName, { type: blob.type });
                if (onDownloadComplete) onDownloadComplete(downloadedFile, downloadAction);
              } else if (event.type === 'error') {
                throw new Error(event.data);
              }
            } catch (e) {
              console.error('Failed to parse SSE', e);
            }
          }
        }
      }
    } catch (err: any) {
      const isAborted = controller.signal.aborted || 
                        err?.name === 'AbortError' || 
                        (typeof err === 'string' && err.toLowerCase().includes('user cancelled')) ||
                        err?.message?.toLowerCase().includes('aborted') ||
                        err?.message?.toLowerCase().includes('cancelled');

      if (isAborted) {
        console.log('Download aborted by user');
      } else {
        alert('Download failed: ' + (err?.message || err));
      }
      setDownloading(false);
      setAbortController(null);
    }
  };

  return (
    <div className={`w-full transition-all duration-300 ${info ? 'max-w-4xl' : 'max-w-lg'} mx-auto flex flex-col gap-3 max-h-full justify-center min-h-0`}>
      {/* Video Card Section */}
      <AnimatePresence>
        {info && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 250, damping: 25 }}
            className="flex-1 overflow-hidden flex flex-col min-h-0"
          >
            <Card className="p-3.5 sm:p-4 gap-4 rounded-2xl sm:rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-xl flex flex-col md:flex-row max-h-full shrink min-h-0 overflow-y-auto">
              
              {/* Left Column: YouTube Preview Player & Timestamp Capture */}
              {info.id && (
                <div className="w-full md:w-1/2 flex flex-col gap-2.5 shrink-0">
                  <div className="flex flex-col">
                    <h2 className="text-sm sm:text-base font-semibold line-clamp-1 leading-tight text-zinc-100">{info.title}</h2>
                    <p className="text-zinc-400 text-xs font-medium mt-0.5">{info.channel || info.uploader}</p>
                  </div>
                  <YouTubePreviewPlayer
                    videoId={info.id}
                    onSetStart={handleSetStartFromPlayer}
                    onSetEnd={handleSetEndFromPlayer}
                    clipRange={(isClipping && !clippingError && endSeconds > startSeconds) ? { start: startSeconds, end: endSeconds } : null}
                    loopRange={loopRange}
                    videoAspectRatio={info.width && info.height ? info.width / info.height : 16/9}
                  />
                </div>
              )}

              {/* Right Column: Controls & Download Options */}
              <div className="w-full md:w-1/2 flex flex-col gap-3.5 overflow-y-auto shrink min-h-0 scrollbar-none">
                
                {/* Format Toggle */}
                <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-full shrink-0">
                  <button 
                    onClick={() => setIsAudio(false)}
                    className={`flex-1 px-3 py-1 rounded-lg font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${!isAudio ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    <Video className="w-3.5 h-3.5" /> Video
                  </button>
                  <button 
                    onClick={() => setIsAudio(true)}
                    className={`flex-1 px-3 py-1 rounded-lg font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${isAudio ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    <Music className="w-3.5 h-3.5" /> Audio Only
                  </button>
                </div>

                {/* Quality Selection Grid */}
                <AnimatePresence>
                  {!isAudio && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }} 
                      exit={{ opacity: 0, height: 0 }} 
                      className="w-full flex flex-col gap-1.5 shrink-0"
                    >
                      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest ml-1">Quality</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { val: '2160', label: '4K', labelFull: '2160p' },
                          { val: '1440', label: '2K', labelFull: '1440p' },
                          { val: '1080', label: 'FHD', labelFull: '1080p' },
                          { val: '720', label: 'HD', labelFull: '720p' },
                          { val: '480', label: 'SD', labelFull: '480p' },
                          { val: '360', label: 'Low', labelFull: '360p' }
                        ].map(opt => {
                          const isAvailable = Boolean(info.sizes?.[opt.val]);
                          const size = info.sizes?.[opt.val] ? `${(info.sizes[opt.val] / 1024 / 1024).toFixed(1)} MB` : '';
                          const isActive = quality === opt.val;
                          return (
                            <button
                              key={opt.val}
                              disabled={!isAvailable}
                              onClick={() => setQuality(opt.val)}
                              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border transition-all ${
                                !isAvailable
                                  ? 'bg-zinc-950/40 border-zinc-900/60 text-zinc-700 cursor-not-allowed opacity-40'
                                  : isActive 
                                    ? 'bg-zinc-800 border-zinc-500 text-zinc-100 shadow-sm' 
                                    : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                              }`}
                            >
                              <span className="font-medium text-xs">{opt.labelFull}</span>
                              <span className="text-[9px] opacity-75 mt-0.5 min-h-[14px]">
                                {isAvailable ? size : 'Unavailable'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Segment Clipping Section (Always Visible) */}
                <div className="w-full flex flex-col gap-2 shrink-0 border-t border-zinc-800/80 pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 flex-wrap">
                      <Scissors className={`w-3.5 h-3.5 ${isClipping ? 'text-amber-400' : 'text-zinc-500'}`} />
                      <span>Clip</span>
                      {endSeconds > startSeconds && (
                        <span className="ml-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/30 flex items-center gap-1">
                          <span>Length:</span>
                          <span>{formatDurationBadge(endSeconds - startSeconds)}</span>
                          <span className="text-amber-400/70 font-normal">({formatSecondsToHHMMSS(endSeconds - startSeconds)})</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsLoopingClip(!isLoopingClip)}
                        disabled={Boolean(clippingError)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50 border ${
                          isLoopingClip 
                            ? 'bg-amber-400 text-black border-transparent shadow-sm' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        <Repeat className="w-3 h-3" />
                        <span>Loop Clip</span>
                      </button>

                      {isClipping && (
                        <button
                          type="button"
                          onClick={handleResetClipping}
                          className="text-[10px] text-zinc-400 hover:text-zinc-200 underline transition-colors"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <TimeSegmentPicker 
                        label="Start Time" 
                        value={startValue} 
                        onChange={setStartValue} 
                        hasError={isStartInvalid} 
                        idPrefix="start"
                        onNavigateBoundary={(dir) => {
                          if (dir === 'right') document.getElementById('end-hours')?.focus();
                        }}
                      />
                      <TimeSegmentPicker 
                        label="End Time" 
                        value={endValue} 
                        onChange={setEndValue} 
                        hasError={isEndInvalid} 
                        idPrefix="end"
                        onNavigateBoundary={(dir) => {
                          if (dir === 'left') document.getElementById('start-seconds')?.focus();
                        }}
                      />
                    </div>
                    {clippingError ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg p-2 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                        <span>{clippingError}</span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-500 ml-1">
                        Edit Start or End time to crop segment. Arrow keys adjust values.
                      </p>
                    )}
                  </div>
                </div>

                {/* Cache Status Banner & Download Action Buttons */}
                <div className="flex flex-col gap-2.5 shrink-0">
                  {isCached && !downloading && (
                    <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs text-emerald-400 font-medium">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Available in Cache Storage {cachedSizeMb ? `(${cachedSizeMb} MB)` : ''}</span>
                      </div>
                      <span className="text-[10px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">Fast Clip Ready</span>
                    </div>
                  )}

                  {isCached && !downloading ? (
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        {/* Button 1: Save/Extract Clip */}
                        <Button 
                          onClick={() => startDownload('download')} 
                          disabled={isClipping && Boolean(clippingError)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold h-11 text-xs sm:text-sm rounded-xl shadow-md gap-1.5"
                        >
                          <Scissors className="w-4 h-4" />
                          <span>Save Clip</span>
                        </Button>

                        {/* Button 2: Open Location */}
                        <Button 
                          onClick={async () => {
                            if (cachedFilePath) {
                              fetch('/api/open-location', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ filepath: cachedFilePath })
                              }).catch(() => {});
                              window.open('/api/serve?file=' + encodeURIComponent(cachedFilePath), '_blank');
                            } else {
                              startDownload('download');
                            }
                          }}
                          variant="outline"
                          className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-white font-bold h-11 text-xs sm:text-sm rounded-xl shadow-md gap-1.5"
                        >
                          <Folder className="w-4 h-4 text-amber-400" />
                          <span>Open Location</span>
                        </Button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsCached(false);
                          startDownload('download');
                        }}
                        className="text-[11px] text-zinc-500 hover:text-zinc-300 underline transition-colors self-center mt-0.5"
                      >
                        Re-download fresh from YouTube
                      </button>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => startDownload('download')} 
                      disabled={(!downloading && loading) || (!downloading && isClipping && Boolean(clippingError))}
                      className={`w-full rounded-xl h-11 text-sm font-bold transition-colors relative overflow-hidden disabled:opacity-50 ${
                        downloading 
                          ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700' 
                          : 'bg-white text-black hover:bg-zinc-200 shadow-md'
                      }`}
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {downloading 
                          ? 'Cancel Download' 
                          : (isClipping ? 'Download & Save Clip' : 'Download Full Video')
                        } 
                        {downloading 
                          ? <div className="w-3 h-3 bg-current rounded-sm" /> 
                          : <Download className="w-4 h-4" />
                        }
                      </span>
                    </Button>
                  )}

                  {/* Progress Indicators */}
                  <AnimatePresence>
                    {downloading && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5">
                        <div className="flex justify-between text-[11px] text-zinc-400 font-medium px-1">
                          <span>{statusText}</span>
                          <span className="text-zinc-100">{progress > 0 ? `${progress.toFixed(1)}%` : 'Fetching stream...'}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden relative">
                          {progress > 0 ? (
                            <div 
                              className="h-full bg-white transition-all duration-300 rounded-full" 
                              style={{ width: `${progress}%` }} 
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-r from-amber-500/20 via-amber-400 to-amber-500/20 animate-pulse rounded-full" />
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                {children && (
                  <div className="w-full mt-4 pt-4 border-t border-zinc-800">
                    {children}
                  </div>
                )}
                
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

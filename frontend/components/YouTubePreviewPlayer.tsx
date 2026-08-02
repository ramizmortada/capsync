'use client';

import React, { useEffect, useRef, useState, useId } from 'react';
import { Play, Pause, Clock, Type, Wand2, Loader2 } from 'lucide-react';
import { TimeValue } from './TimeSegmentPicker';

interface YouTubePreviewPlayerProps {
  videoId: string;
  onSetStart: (val: TimeValue) => void;
  onSetEnd: (val: TimeValue) => void;
  clipRange?: { start: number; end: number } | null;
  loopRange?: { start: number; end: number } | null;
  videoAspectRatio?: number;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: any;
    activeYouTubePlayerId?: string;
  }
}

const formatDisplayTime = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function YouTubePreviewPlayer({ videoId, onSetStart, onSetEnd, clipRange, loopRange, videoAspectRatio = 16/9 }: YouTubePreviewPlayerProps) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<any>(null);
  const uniqueId = useId().replace(/:/g, '');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptData, setTranscriptData] = useState<any>(null);

  const isVertical = videoAspectRatio < 1;
  const iframeWidthPercent = isVertical ? videoAspectRatio * (9 / 16) * 100 : 100;

  // Seek to start position when loopRange changes without auto-playing
  useEffect(() => {
    if (loopRange && playerRef.current && typeof playerRef.current.seekTo === 'function') {
      try {
        playerRef.current.seekTo(loopRange.start, true);
        setCurrentTime(loopRange.start);
      } catch (e) {}
    }
  }, [loopRange?.start, loopRange?.end]);

  useEffect(() => {
    let isMounted = true;

    const createPlayer = () => {
      if (!isMounted || !containerRef.current) return;

      containerRef.current.innerHTML = '';
      const playerDiv = document.createElement('div');
      playerDiv.id = `yt-player-${videoId}-${uniqueId}`;
      containerRef.current.appendChild(playerDiv);

      playerRef.current = new window.YT.Player(playerDiv.id, {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          enablejsapi: 1,
          cc_load_policy: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
        },
        events: {
          onReady: (event: any) => {
            if (isMounted) {
              setDuration(event.target.getDuration() || 0);
              // Set as active if none exists
              if (!window.activeYouTubePlayerId) {
                window.activeYouTubePlayerId = uniqueId;
              }
              // Hide captions by default initially
              if (typeof event.target.setOption === 'function') {
                event.target.setOption('captions', 'track', {});
              } else if (typeof event.target.unloadModule === 'function') {
                event.target.unloadModule("captions");
              }
            }
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              window.activeYouTubePlayerId = uniqueId;
              window.dispatchEvent(new CustomEvent('stopOtherPlayers', { detail: { id: uniqueId } }));
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              // Prevent the "More Videos" grid from showing by instantly seeking to start and pausing
              if (playerRef.current) {
                playerRef.current.seekTo(clipRange?.start || loopRange?.start || 0, true);
                playerRef.current.pauseVideo();
              }
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      if (!document.getElementById('yt-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        createPlayer();
      };
    }

    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (e) {}
      }
    };
  }, [videoId]);

  // Update current time on interval when playing and handle loop boundaries
  useEffect(() => {
    if (isPlaying && !isSeeking) {
      intervalRef.current = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const cur = playerRef.current.getCurrentTime();
          setCurrentTime(cur);
          if (!duration && typeof playerRef.current.getDuration === 'function') {
            setDuration(playerRef.current.getDuration());
          }

          // Handle looping boundary
          if (loopRange && loopRange.end > loopRange.start) {
            if (cur >= loopRange.end - 0.2 || cur < loopRange.start) {
              playerRef.current.seekTo(loopRange.start, true);
              if (playerRef.current && typeof playerRef.current.playVideo === 'function') playerRef.current.playVideo();
            }
          }
        }
      }, 150);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, isSeeking, duration, loopRange]);

  // Handle auto-pause when another player starts
  useEffect(() => {
    const handleStopOthers = (e: any) => {
      if (e.detail.id !== uniqueId && isPlaying && playerRef.current) {
        if (typeof playerRef.current.pauseVideo === 'function') {
          try { playerRef.current.pauseVideo(); } catch(e) {}
        }
        setIsPlaying(false);
      }
    };
    window.addEventListener('stopOtherPlayers', handleStopOthers);
    return () => window.removeEventListener('stopOtherPlayers', handleStopOthers);
  }, [isPlaying, uniqueId]);

  // Handle global caption toggling
  useEffect(() => {
    const handleGlobalCaptions = (e: any) => {
      const show = e.detail.showCaptions;
      setShowCaptions(show);
      if (playerRef.current) {
        if (show) {
          if (!transcriptData) {
            if (typeof playerRef.current.loadModule === 'function') playerRef.current.loadModule("captions");
            if (typeof playerRef.current.setOption === 'function') {
              try {
                const tracks = playerRef.current.getOption('captions', 'tracklist');
                if (tracks && tracks.length > 0) {
                  playerRef.current.setOption("captions", "track", tracks[0]);
                } else {
                  playerRef.current.setOption("captions", "track", {languageCode: "en"});
                  playerRef.current.setOption("captions", "track", {languageCode: "a.en"});
                }
              } catch(err) {}
            }
          }
        } else {
          if (typeof playerRef.current.setOption === 'function') {
            playerRef.current.setOption("captions", "track", {});
          } else if (typeof playerRef.current.unloadModule === 'function') {
            playerRef.current.unloadModule("captions");
          }
        }
      }
    };
    window.addEventListener('toggleGlobalCaptions', handleGlobalCaptions);
    return () => window.removeEventListener('toggleGlobalCaptions', handleGlobalCaptions);
  }, [transcriptData]);

  // Global keyboard shortcuts for video seeking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if this is not the active player
      if (window.activeYouTubePlayerId && window.activeYouTubePlayerId !== uniqueId) return;

      // Ignore if user is typing in a text input or textarea
      const active = document.activeElement as HTMLInputElement;
      if (
        active &&
        (active.tagName === 'TEXTAREA' || 
        (active.tagName === 'INPUT' && active.type !== 'range' && active.type !== 'button' && active.type !== 'checkbox'))
      ) {
        return;
      }

      if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;

      let seekAmount = 0;
      if (e.key === 'ArrowLeft') {
        seekAmount = e.shiftKey ? -30 : -5;
      } else if (e.key === 'ArrowRight') {
        seekAmount = e.shiftKey ? 30 : 5;
      } else if (e.key === 'd' || e.key === 'D') {
        seekAmount = -1;
      } else if (e.key === 'f' || e.key === 'F') {
        seekAmount = 1;
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        const current = playerRef.current.getCurrentTime();
        onSetStart({
          hours: Math.floor(current / 3600).toString().padStart(2, '0'),
          minutes: Math.floor((current % 3600) / 60).toString().padStart(2, '0'),
          seconds: Math.floor(current % 60).toString().padStart(2, '0')
        });
        return;
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        const current = playerRef.current.getCurrentTime();
        onSetEnd({
          hours: Math.floor(current / 3600).toString().padStart(2, '0'),
          minutes: Math.floor((current % 3600) / 60).toString().padStart(2, '0'),
          seconds: Math.floor(current % 60).toString().padStart(2, '0')
        });
        return;
      } else if (e.key === ' ') {
        e.preventDefault();
        if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
          const state = playerRef.current.getPlayerState();
          if (state === 1) { // PLAYING
            if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') playerRef.current.pauseVideo();
          } else {
            if (playerRef.current && typeof playerRef.current.playVideo === 'function') playerRef.current.playVideo();
          }
        }
        return;
      }

      if (seekAmount !== 0) {
        e.preventDefault();
        const current = playerRef.current.getCurrentTime();
        let next = current + seekAmount;
        if (next < 0) next = 0;
        if (duration && next > duration) next = duration;
        
        playerRef.current.seekTo(next, true);
        setCurrentTime(next);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration]);

  const togglePlayPause = () => {
    if (!playerRef.current) return;
    try {
      window.activeYouTubePlayerId = uniqueId;
      if (isPlaying) {
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        if (playerRef.current && typeof playerRef.current.playVideo === 'function') playerRef.current.playVideo();
        setIsPlaying(true);
        window.dispatchEvent(new CustomEvent('stopOtherPlayers', { detail: { id: uniqueId } }));
      }
    } catch (e) {
      console.error('Failed to toggle play/pause:', e);
    }
  };

  const handleSeek = (newTimeSec: number) => {
    setCurrentTime(newTimeSec);
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      try {
        playerRef.current.seekTo(newTimeSec, true);
      } catch (e) {}
    }
  };

  const toggleCaptions = () => {
    const newState = !showCaptions;
    setShowCaptions(newState);
    window.dispatchEvent(new CustomEvent('toggleGlobalCaptions', { detail: { showCaptions: newState } }));
  };

  const handleTranscribeClip = async () => {
    if (!clipRange || !clipRange.start || !clipRange.end) {
      alert("Please set a valid clip range first.");
      return;
    }
    
    setIsTranscribing(true);
    setShowCaptions(true); // Automatically show them when done
    try {
      const res = await fetch('/api/clip-transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          startTime: clipRange.start,
          endTime: clipRange.end
        })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      const data = await res.json();
      setTranscriptData(data);
    } catch (e) {
      console.error("Transcription failed:", e);
      alert("Transcription failed. See console for details.");
      setShowCaptions(false);
    } finally {
      setIsTranscribing(false);
    }
  };

  const secondsToTimeValue = (secs: number): TimeValue => {
    const totalSeconds = Math.max(0, Math.floor(secs));
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    return {
      hours: hrs.toString().padStart(2, '0'),
      minutes: mins.toString().padStart(2, '0'),
      seconds: s.toString().padStart(2, '0'),
    };
  };

  const handleSetStart = () => {
    let cur = currentTime;
    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      try {
        cur = playerRef.current.getCurrentTime();
      } catch (e) {}
    }
    onSetStart(secondsToTimeValue(cur));
  };

  const handleSetEnd = () => {
    let cur = currentTime;
    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      try {
        cur = playerRef.current.getCurrentTime();
      } catch (e) {}
    }
    onSetEnd(secondsToTimeValue(cur));
  };

  return (
    <div 
      className="flex flex-col gap-2.5 w-full"
      onMouseEnter={() => { window.activeYouTubePlayerId = uniqueId; }}
      onClick={() => { window.activeYouTubePlayerId = uniqueId; }}
    >
      {/* Video Container with CSS cropping to hide top title bar and bottom YouTube overlays */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-zinc-800 shadow-md group">
        <div 
          ref={containerRef} 
          className="absolute overflow-hidden [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0 [&>iframe]:pointer-events-none"
          style={
            isVertical
              ? {
                  width: `${iframeWidthPercent}%`,
                  height: '100%',
                  left: '50%',
                  top: '0',
                  transform: 'translateX(-50%)',
                }
              : {
                  width: '100%',
                  height: '100%',
                  left: '0',
                  top: '0',
                }
          }
        />
        
        {/* Custom AI Subtitle Overlay */}
        {showCaptions && transcriptData && transcriptData.segments && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-end pb-8 z-20 overflow-hidden">
            {transcriptData.segments.map((seg: any, i: number) => {
              // The AI transcript is based on the cropped audio which starts at 0s.
              // We must offset the absolute YouTube time by the clip start time.
              const relativeTime = currentTime - (clipRange?.start || 0);

              const isActiveSegment = relativeTime >= seg.start && relativeTime <= seg.end;
              if (!isActiveSegment) return null;

              return (
                <div key={i} className="flex flex-wrap justify-center items-center gap-x-1.5 px-4 text-center">
                  {seg.words?.map((w: any, idx: number) => {
                    const isActiveWord = relativeTime >= w.start && relativeTime <= w.end;
                    const isPastWord = relativeTime > w.end;
                    
                    // Signature Editor Style: Yellow highlight for active, white for past, transparent white for future
                    let colorClass = "text-white/60";
                    if (isActiveWord) colorClass = "text-amber-400 font-bold scale-110 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]";
                    else if (isPastWord) colorClass = "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]";

                    return (
                      <span 
                        key={idx} 
                        className={`text-xl sm:text-2xl font-black uppercase transition-all duration-150 ${colorClass}`}
                        style={{ WebkitTextStroke: isActiveWord || isPastWord ? '1px rgba(0,0,0,0.5)' : 'none' }}
                      >
                        {w.word}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Invisible Click-to-toggle overlay */}
        <button
          type="button"
          onClick={togglePlayPause}
          className="absolute inset-0 w-full h-full cursor-pointer bg-transparent z-10"
          aria-label="Toggle play pause"
        />
      </div>

      {/* Custom Control Bar */}
      <div className="flex flex-col gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-2.5">
        {/* Scrub Slider */}
        <div className="relative w-full flex items-center h-3 group cursor-pointer">
          {/* Base Track */}
          <div className="absolute left-0 right-0 h-1.5 bg-zinc-800 rounded-lg pointer-events-none" />

          {/* Highlight Segment */}
          {clipRange && duration > 0 && clipRange.end > clipRange.start && (
            <div 
              className="absolute h-1.5 bg-amber-400/30 rounded-lg pointer-events-none"
              style={{
                left: `${(clipRange.start / duration) * 100}%`,
                width: `${((Math.min(clipRange.end, duration) - clipRange.start) / duration) * 100}%`
              }}
            />
          )}

          {/* Custom Thumb / Playhead */}
          <div 
            className="absolute h-3 w-3 bg-amber-400 rounded-full shadow-sm pointer-events-none -ml-1.5 transition-transform z-10"
            style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />

          {/* Invisible Interactive Range Input */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onMouseDown={() => setIsSeeking(true)}
            onTouchStart={() => setIsSeeking(true)}
            onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
            onMouseUp={(e) => {
              setIsSeeking(false);
              handleSeek(parseFloat((e.target as HTMLInputElement).value));
            }}
            onTouchEnd={(e) => {
              setIsSeeking(false);
              handleSeek(parseFloat((e.target as HTMLInputElement).value));
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
        </div>

        {/* Play/Pause & Time & Capture Actions */}
        <div className="flex items-center justify-between gap-2">
          {/* Play/Pause Toggle & Time Display */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlayPause}
              className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 flex items-center justify-center transition-colors"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
            </button>

            <span className="text-[11px] font-mono text-zinc-300 font-medium">
              {formatDisplayTime(currentTime)} <span className="text-zinc-600">/</span> {formatDisplayTime(duration)}
            </span>
          </div>

          {/* Quick Timestamp Capture Buttons & CC */}
          <div className="flex items-center gap-1.5 ml-auto">
            {!transcriptData ? (
              <button
                type="button"
                onClick={handleTranscribeClip}
                disabled={isTranscribing}
                className="px-2 py-1 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-[10px] font-semibold text-amber-400 flex items-center gap-1 transition-colors disabled:opacity-50"
                title="Transcribe Clip via AI"
              >
                {isTranscribing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                <span>AI Captions</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleCaptions}
                className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 transition-colors"
                title="Toggle Captions"
              >
                <Type className={`w-3 h-3 ${showCaptions ? 'text-amber-400' : 'text-zinc-400'}`} />
              </button>
            )}
            <button
              type="button"
              onClick={handleSetStart}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-[10px] font-semibold text-zinc-200 flex items-center gap-1 transition-colors"
            >
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Set Start</span>
            </button>
            <button
              type="button"
              onClick={handleSetEnd}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-[10px] font-semibold text-zinc-200 flex items-center gap-1 transition-colors"
            >
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Set End</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

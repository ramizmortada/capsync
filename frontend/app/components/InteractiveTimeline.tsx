import { Card } from "@/components/ui/card";
import { memo, useState, useEffect, useRef } from "react";
import type { DragTarget } from "../page";
import { TimelineControls } from "./timeline/TimelineControls";
import { TimeRuler } from "./timeline/TimeRuler";
import { TimelineBoundaries } from "./timeline/TimelineBoundaries";
import { TimelineContextMenu } from "./timeline/TimelineContextMenu";
import { useAudioWaveform } from "../../hooks/useAudioWaveform";
import { AudioWaveform } from "./timeline/AudioWaveform";
import { Type, Film, AudioLines } from "lucide-react";

interface InteractiveTimelineProps {
  isPlaying: boolean;
  togglePlay: () => void;
  stopPlay: () => void;
  currentTime: number;
  mediaDuration: number;
  file: File | null;
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  isHoveringTimeline: React.MutableRefObject<boolean>;
  trackRef: React.RefObject<HTMLDivElement | null>;
  editableSegments: any[];
  cutZones: { start: number; end: number }[];
  rippleDeletes: { start: number; end: number }[];
  selectedIndexes: (number|string)[];
  setSelectedIndexes: React.Dispatch<React.SetStateAction<(number|string)[]>>;
  handleLiftDelete: (indices: (number|string)[]) => void;
  handleRippleDelete: (indices: (number|string)[]) => void;
  setDraggingBoundary: (val: DragTarget | null) => void;
  draggingBoundary: DragTarget | null;
  onSeek: (time: number) => void;
  handleToggleWordDelete: (segmentIndex: number, wordIndex: number) => void;
}

export const InteractiveTimeline = memo(function InteractiveTimeline({
  isPlaying,
  togglePlay,
  stopPlay,
  currentTime,
  mediaDuration,
  file,
  zoomLevel,
  setZoomLevel,
  timelineRef,
  isHoveringTimeline,
  trackRef,
  editableSegments,
  cutZones,
  rippleDeletes,
  selectedIndexes,
  setSelectedIndexes,
  handleRippleDelete,
  setDraggingBoundary,
  draggingBoundary,
  onSeek,
  handleToggleWordDelete,
}: InteractiveTimelineProps) {
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    segmentIdx: number;
    wordIdx: number;
    isDeleted: boolean;
    type: 'Silence' | 'Word';
  } | null>(null);
  const lastSelectedRef = useRef<number | null>(null);

  const { peaks, isGenerating } = useAudioWaveform(file);

  const sortedRippleDeletes = [...(rippleDeletes || [])].sort((a, b) => a.start - b.start);

  useEffect(() => {
    const handleWindowClick = () => {
      setContextMenu(null);
    };
    window.addEventListener('pointerdown', handleWindowClick);
    return () => {
      window.removeEventListener('pointerdown', handleWindowClick);
    };
  }, []);

  const toTimelineTime = (mediaTime: number) => {
    let timelineTime = mediaTime;
    for (const zone of sortedRippleDeletes) {
      if (mediaTime >= zone.end) {
        timelineTime -= (zone.end - zone.start);
      } else if (mediaTime > zone.start) {
        timelineTime -= (mediaTime - zone.start);
      }
    }
    return Math.max(0, timelineTime);
  };

  const toMediaTime = (timelineTime: number) => {
    let mediaTime = timelineTime;
    for (const zone of sortedRippleDeletes) {
      if (mediaTime >= zone.start) {
        mediaTime += (zone.end - zone.start);
      }
    }
    return Math.min(mediaTime, mediaDuration);
  };

  const timelineDuration = Math.max(toTimelineTime(mediaDuration), 0.1);

  useEffect(() => {
    if (!isDraggingPlayhead || !trackRef.current) return;
    
    const handleMove = (e: PointerEvent) => {
      const trackRect = trackRef.current!.getBoundingClientRect();
      let clickX = e.clientX - trackRect.left;
      clickX = Math.max(0, Math.min(clickX, trackRect.width));
      const percentage = clickX / trackRect.width;
      const targetTimelineTime = percentage * timelineDuration;
      onSeek(toMediaTime(targetTimelineTime));
    };

    const handleUp = () => {
      setIsDraggingPlayhead(false);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDraggingPlayhead, timelineDuration, mediaDuration, trackRef, onSeek, sortedRippleDeletes]);

  const handleTrackClick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) return;
    
    setSelectedIndexes([]);
    lastSelectedRef.current = null;

    if ((e.target as HTMLElement).closest('.group')) return;
    
    if (!trackRef.current || timelineDuration <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const targetTimelineTime = percentage * timelineDuration;
    onSeek(toMediaTime(targetTimelineTime));
  };

  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      isHoveringTimeline.current = true;
      clearTimeout((timelineRef as any)._timeout);
      (timelineRef as any)._timeout = setTimeout(() => isHoveringTimeline.current = false, 1000);

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomDelta = e.deltaY < 0 ? 0.5 : -0.5;
        setZoomLevel(Math.max(1, Math.min(50, zoomLevel + zoomDelta)));
      } else if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [timelineRef, zoomLevel, setZoomLevel, isHoveringTimeline]);

  return (
    <Card className="bg-card border-border shadow-2xl p-2">
      <TimelineControls
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        stopPlay={stopPlay}
        currentTime={currentTime}
        mediaDuration={mediaDuration}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
      />

      {/* Scrollable Timeline Container with Headers */}
      <div className="flex bg-background rounded-xl overflow-hidden h-40">
        
        {/* Track Headers (Left Panel) */}
        <div className="w-12 shrink-0 bg-neutral-900/50 border-r border-neutral-800 flex flex-col relative z-10 pointer-events-none">
          <div className="absolute top-[28px] w-full flex justify-center text-neutral-500" title="Subtitles">
            <Type className="w-4 h-4" />
          </div>
          <div className="absolute top-[68px] w-full flex justify-center text-neutral-500" title="Video">
            <Film className="w-4 h-4" />
          </div>
          <div className="absolute top-[112px] w-full flex justify-center text-neutral-500" title="Audio">
            <AudioLines className="w-4 h-4" />
          </div>
        </div>

        {/* Scrollable Area */}
        <div 
          ref={timelineRef}
          onPointerDown={() => {
            isHoveringTimeline.current = true;
            clearTimeout((timelineRef as any)._timeout);
          }}
          onPointerUp={() => {
            (timelineRef as any)._timeout = setTimeout(() => isHoveringTimeline.current = false, 1000);
          }}
          className="relative flex-1 overflow-x-auto overflow-y-hidden select-none [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-background [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-accent transition-colors"
        >
        {/* Scaled Inner Track */}
        <div 
          ref={trackRef}
          className="relative h-full cursor-default min-w-full"
          style={{ width: `${zoomLevel * 100}%` }}
          onPointerDown={handleTrackClick}
        >
          {/* Time Ticks */}
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGgwLjV2NDBIMHoiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] bg-repeat-x" />

          {/* Video Track Continuous Background */}
          <div className="absolute top-[60px] h-8 bg-neutral-800/30 w-full border-y border-neutral-800/50 pointer-events-none z-0 flex items-center px-2 text-[10px] text-neutral-500 font-medium">
            Video Strip
          </div>

          {/* Audio Track Continuous Background */}
          <div className="absolute top-[100px] h-10 bg-emerald-900/10 w-full border-y border-emerald-900/20 pointer-events-none z-0">
            {isGenerating ? (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-emerald-500/50">
                Generating waveform...
              </div>
            ) : (
              <AudioWaveform 
                peaks={peaks}
                mediaDuration={mediaDuration}
                timelineDuration={timelineDuration}
                toTimelineTime={toTimelineTime}
              />
            )}
          </div>

          {/* Dynamic Time Ruler */}
          <TimeRuler timelineDuration={timelineDuration} zoomLevel={zoomLevel} />

          {/* Subtitle Segments blocks */}
          {editableSegments.map((segment, index) => {
            const tlStart = toTimelineTime(segment.start);
            const tlEnd = toTimelineTime(segment.end);
            const left = (tlStart / timelineDuration) * 100;
            const width = ((tlEnd - tlStart) / timelineDuration) * 100;
            const isActive = currentTime >= (segment.start - 0.05) && currentTime < (segment.end - 0.05);
            
            const realWords = segment.words ? segment.words.filter((w: any) => !w.isGap) : [];
            const isSilenced = realWords.length > 0 && realWords.every((w: any) => w.deleted);
            const isSelected = selectedIndexes.includes(index);
            
            return (
              <div 
                key={index}
                onPointerDown={(e) => {
                  if (zoomLevel >= 15) return; // Parent is intangible when zoomed in
                  e.stopPropagation();
                  if (e.shiftKey) {
                    if (lastSelectedRef.current !== null) {
                      const start = Math.min(lastSelectedRef.current, index);
                      const end = Math.max(lastSelectedRef.current, index);
                      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                      setSelectedIndexes(prev => Array.from(new Set([...prev, ...range])));
                    } else {
                      setSelectedIndexes([index]);
                      lastSelectedRef.current = index;
                    }
                  } else if (e.ctrlKey || e.metaKey) {
                    setSelectedIndexes(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
                    lastSelectedRef.current = index;
                  } else {
                    setSelectedIndexes([index]);
                    lastSelectedRef.current = index;
                  }
                }}
                className={`absolute top-[20px] h-8 rounded text-[10px] p-1 font-medium transition-colors border ${
                  zoomLevel >= 15 
                    ? 'bg-transparent border-transparent z-10 pointer-events-none'
                    : 'overflow-hidden ' + (isSelected
                      ? 'bg-emerald-500/20 border-emerald-400 z-20 text-emerald-100'
                      : isSilenced
                        ? 'bg-red-950/20 border-red-900/30 text-red-500/60 opacity-60 line-through z-10'
                        : isActive 
                        ? 'bg-accent-blue/30 border-accent-blue/50 text-blue-100 z-20' 
                        : 'bg-muted/40 border-border text-muted-foreground z-10 hover:border-muted-foreground/50 hover:z-20')
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                {zoomLevel >= 15 && segment.words && segment.words.length > 0 ? (
                  null
                ) : (
                  <div className="truncate relative z-20">{segment.text}</div>
                )}
              </div>
            );
          })}

          {/* Render word-level segments directly at the track level when zoomed in */}
          {zoomLevel >= 15 && editableSegments.map((segment, index) => {
            if (!segment.words || segment.words.length === 0) return null;
            return segment.words.map((word: any, wIdx: number) => {
              const tlStart = toTimelineTime(word.start);
              const tlEnd = toTimelineTime(word.end);
              const left = (tlStart / timelineDuration) * 100;
              const width = ((tlEnd - tlStart) / timelineDuration) * 100;
              const isDeleted = word.deleted;

              const selectItem = (e: React.MouseEvent | React.PointerEvent) => {
                e.stopPropagation(); 
                const key = word.isGap ? `gap:${index}:${wIdx}` : `word:${index}:${wIdx}`;
                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                  setSelectedIndexes(prev => prev.includes(key) ? prev.filter(i => i !== key) : [...prev, key]);
                } else {
                  setSelectedIndexes([key]);
                }
              };

              const handleContextMenu = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                selectItem(e);
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  segmentIdx: index,
                  wordIdx: wIdx,
                  isDeleted: word.deleted,
                  type: word.isGap ? 'Silence' : 'Word'
                });
              };

              if (word.isGap) {
                return (
                  <div 
                    key={`track-gap-${index}-${wIdx}`} 
                    onPointerDown={selectItem}
                    onContextMenu={handleContextMenu}
                    onDoubleClick={(e) => { e.stopPropagation(); onSeek(word.start); }}
                    className={`pointer-events-auto absolute top-[20px] h-8 flex items-center justify-center transition-colors z-35 cursor-pointer rounded border border-dashed ${isDeleted ? 'bg-red-950/60 text-red-500/60 border-red-900/30 line-through' : selectedIndexes.includes(`gap:${index}:${wIdx}`) ? 'bg-emerald-500/40 border-emerald-400 z-40 text-emerald-100' : 'bg-emerald-950/20 text-emerald-400 border-emerald-900/50 hover:bg-emerald-950/75 hover:border-emerald-800'}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    <span className="truncate w-full text-center text-[9px] opacity-60">⏸️</span>
                  </div>
                );
              }

              return (
                <div 
                  key={`track-word-${index}-${wIdx}`} 
                  onPointerDown={selectItem}
                  onContextMenu={handleContextMenu}
                  onDoubleClick={(e) => { e.stopPropagation(); onSeek(word.start); }}
                  className={`pointer-events-auto absolute top-[20px] h-8 flex items-center justify-center transition-colors z-35 cursor-pointer rounded border ${isDeleted ? 'bg-red-950/70 text-red-400 border-red-900/50 hover:bg-red-900/70 line-through' : selectedIndexes.includes(`word:${index}:${wIdx}`) ? 'bg-emerald-500/40 border-emerald-400 z-40 text-emerald-100' : 'bg-muted/40 border-border hover:border-muted-foreground/50 hover:z-40 text-muted-foreground'}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <span className="truncate w-full text-center text-[9px]">{word.word}</span>
                </div>
              );
            });
          })}

          {/* Render global gap-free cut zones on the Video track */}
          {cutZones && cutZones.map((zone, idx) => {
            const tlStart = toTimelineTime(zone.start);
            const tlEnd = toTimelineTime(zone.end);
            const left = (tlStart / timelineDuration) * 100;
            const width = ((tlEnd - tlStart) / timelineDuration) * 100;
            
            if (width <= 0.01) return null;

            return (
              <div 
                key={`zone-v-${idx}`}
                className="absolute top-[60px] h-8 bg-red-600/35 border-l border-r border-red-500/50 pointer-events-none z-10"
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            );
          })}

          {/* Render global gap-free cut zones on the Audio track */}
          {cutZones && cutZones.map((zone, idx) => {
            const tlStart = toTimelineTime(zone.start);
            const tlEnd = toTimelineTime(zone.end);
            const left = (tlStart / timelineDuration) * 100;
            const width = ((tlEnd - tlStart) / timelineDuration) * 100;
            
            if (width <= 0.01) return null;

            return (
              <div 
                key={`zone-a-${idx}`}
                className="absolute top-[100px] h-10 bg-red-600/35 border-l border-r border-red-500/50 pointer-events-none z-10"
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            );
          })}

          {/* Draggable Boundaries */}
          <TimelineBoundaries
            zoomLevel={zoomLevel}
            editableSegments={editableSegments}
            toTimelineTime={toTimelineTime}
            timelineDuration={timelineDuration}
            draggingBoundary={draggingBoundary}
            setDraggingBoundary={setDraggingBoundary}
          />

          {/* Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-8 -ml-4 z-20 flex justify-center cursor-grab active:cursor-grabbing group"
            style={{ left: `${(toTimelineTime(currentTime) / timelineDuration) * 100}%` }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingPlayhead(true);
            }}
          >
            <div className="w-0.5 h-full bg-red-500 pointer-events-none relative">
              <div className={`absolute -top-1 -left-1.5 w-3.5 h-3.5 rounded-full transition-transform ${isDraggingPlayhead ? 'bg-red-400 scale-125' : 'bg-red-500 group-hover:scale-125'}`} />
            </div>
          </div>
        </div>
      </div>
    </div>

      {contextMenu && (
        <TimelineContextMenu
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          handleToggleWordDelete={handleToggleWordDelete}
          handleRippleDelete={handleRippleDelete}
        />
      )}
    </Card>
  );
});

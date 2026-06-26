import { ZoomIn, ZoomOut, Play, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { memo, useState, useEffect, useRef } from "react";
import { formatUiTime } from "@/lib/utils";
import type { DragTarget } from "../page";

interface InteractiveTimelineProps {
  isPlaying: boolean;
  togglePlay: () => void;
  stopPlay: () => void;
  currentTime: number;
  mediaDuration: number;
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

// Easily change this variable to adjust the size of the boundary cursors!
const CURSOR_SIZE = 22;

const getCursorStyle = (type: 'left' | 'right' | 'both') => {
  const hs = Math.floor(CURSOR_SIZE / 2);
  let svg = '';
  if (type === 'right') {
    svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${CURSOR_SIZE}' height='${CURSOR_SIZE}' viewBox='0 0 24 24' fill='none'><g stroke='black' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M3 5v14'/><path d='M21 12H7'/><path d='m15 18 6-6-6-6'/></g><g stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 5v14'/><path d='M21 12H7'/><path d='m15 18 6-6-6-6'/></g></svg>`;
  } else if (type === 'left') {
    svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${CURSOR_SIZE}' height='${CURSOR_SIZE}' viewBox='0 0 24 24' fill='none'><g stroke='black' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='m9 6-6 6 6 6'/><path d='M3 12h14'/><path d='M21 19V5'/></g><g stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m9 6-6 6 6 6'/><path d='M3 12h14'/><path d='M21 19V5'/></g></svg>`;
  } else {
    svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${CURSOR_SIZE}' height='${CURSOR_SIZE}' viewBox='0 0 24 24' fill='none'><g stroke='black' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></g><g stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></g></svg>`;
  }
  const fallback = type === 'right' ? 'e-resize' : type === 'left' ? 'w-resize' : 'col-resize';
  return { cursor: `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hs} ${hs}, ${fallback}` };
};

export const InteractiveTimeline = memo(function InteractiveTimeline({
  isPlaying,
  togglePlay,
  stopPlay,
  currentTime,
  mediaDuration,
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
  handleLiftDelete,
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
    // If holding modifier keys, don't move playhead (assume selection)
    if (e.shiftKey || e.ctrlKey || e.metaKey) return;
    
    // Deselect all
    setSelectedIndexes([]);
    lastSelectedRef.current = null;

    // Prevent triggering if clicking a draggable boundary
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
      {/* Timeline Header (Controls) */}
      <div className="flex items-center justify-between px-2 mb-2 gap-4">
        
        {/* Play Controls */}
        <div className="flex items-center gap-1">
          <Button 
            onClick={togglePlay} 
            variant="ghost"
            size="icon" 
            className="rounded-full shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-1 fill-current" />}
          </Button>
          <Button 
            onClick={stopPlay} 
            variant="ghost"
            size="icon" 
            className="rounded-full shrink-0 text-muted-foreground/80 hover:text-foreground hover:bg-muted"
            title="Stop and reset to start"
          >
            <Square className="w-4 h-4 fill-current" />
          </Button>
          <div className="ml-2 text-xs font-mono text-muted-foreground bg-background px-3 py-1.5 rounded-lg border border-border tracking-widest hidden sm:block">
            {formatUiTime(currentTime)} / {formatUiTime(mediaDuration)}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-3 w-48 bg-background px-3 py-1.5 rounded-lg border border-border">
          <ZoomOut className="w-4 h-4 text-muted-foreground" />
          <input 
            type="range" 
            min="1" 
            max="50" 
            step="0.5" 
            value={zoomLevel} 
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent-blue [&::-webkit-slider-thumb]:rounded-full"
          />
          <ZoomIn className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* Scrollable Timeline Container */}
      <div 
        ref={timelineRef}
        onPointerDown={() => {
          isHoveringTimeline.current = true;
          clearTimeout((timelineRef as any)._timeout);
        }}
        onPointerUp={() => {
          (timelineRef as any)._timeout = setTimeout(() => isHoveringTimeline.current = false, 1000);
        }}
        className="relative h-32 bg-background rounded-xl overflow-x-auto overflow-y-hidden select-none [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-background [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-accent transition-colors"
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

          {/* Track Labels */}
          <div className="absolute left-2 top-7 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest pointer-events-none z-0">Subtitles</div>
          <div className="absolute left-2 top-20 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest pointer-events-none z-0">Video</div>

          {/* Video Track Continuous Background */}
          <div className="absolute top-18 h-10 bg-emerald-900/10 w-full border-y border-emerald-900/20 pointer-events-none z-0" />

          {/* Dynamic Time Ruler */}
          {(() => {
            if (timelineDuration <= 0) return null;
            let intervalSeconds = 5;
            if (zoomLevel >= 30) intervalSeconds = 0.1;
            else if (zoomLevel >= 15) intervalSeconds = 0.5;
            else if (zoomLevel >= 4) intervalSeconds = 1;
            else if (zoomLevel >= 2) intervalSeconds = 2;
            else if (timelineDuration > 300) intervalSeconds = 15;
            else if (timelineDuration > 60) intervalSeconds = 10;
            
            const numTicks = Math.floor(timelineDuration / intervalSeconds);
            const ticks = Array.from({ length: numTicks + 1 }, (_, i) => i * intervalSeconds);
            
            return ticks.map(tick => {
              const leftPercent = (tick / timelineDuration) * 100;
              return (
                <div key={`tick-${tick}`} className="absolute top-0 text-[10px] text-neutral-500 pointer-events-none transform -translate-x-1/2" style={{ left: `${leftPercent}%` }}>
                  {formatUiTime(tick)}
                </div>
              );
            });
          })()}

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
                className={`absolute top-5 h-8 rounded text-[10px] p-1 font-medium transition-colors border ${
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
                  // Render nothing inside the parent block; words are rendered at track level below
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
                    className={`pointer-events-auto absolute top-5 h-8 flex items-center justify-center transition-colors z-35 cursor-pointer rounded border border-dashed ${isDeleted ? 'bg-red-950/60 text-red-500/60 border-red-900/30 line-through' : selectedIndexes.includes(`gap:${index}:${wIdx}`) ? 'bg-emerald-500/40 border-emerald-400 z-40 text-emerald-100' : 'bg-emerald-950/20 text-emerald-400 border-emerald-900/50 hover:bg-emerald-950/75 hover:border-emerald-800'}`}
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
                  className={`pointer-events-auto absolute top-5 h-8 flex items-center justify-center transition-colors z-35 cursor-pointer rounded border ${isDeleted ? 'bg-red-950/70 text-red-400 border-red-900/50 hover:bg-red-900/70 line-through' : selectedIndexes.includes(`word:${index}:${wIdx}`) ? 'bg-emerald-500/40 border-emerald-400 z-40 text-emerald-100' : 'bg-muted/40 border-border hover:border-muted-foreground/50 hover:z-40 text-muted-foreground'}`}
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
                key={`zone-${idx}`}
                className="absolute top-18 h-10 bg-red-600/35 border-l border-r border-red-500/50 pointer-events-none z-10"
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            );
          })}

          {/* Draggable Boundaries */}
          {zoomLevel >= 3 && (
            <>
              {/* First segment start boundary */}
              {editableSegments.length > 0 && (
                <div
                  onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary('start'); }}
                  className="absolute top-0 bottom-0 w-8 -ml-4 z-30 flex justify-center items-center group"
                  style={{ left: `${(toTimelineTime(editableSegments[0].start) / timelineDuration) * 100}%`, ...getCursorStyle('right') }}
                >
                  <div className={`w-0.5 h-full transition-colors ${draggingBoundary === 'start' ? 'bg-emerald-400 w-1' : 'bg-accent-blue/40 group-hover:bg-emerald-400 group-hover:w-1'}`} />
                </div>
              )}

              {/* Boundaries for segments */}
              {editableSegments.map((segment, index) => {
                const elements: any[] = [];

                if (zoomLevel >= 15 && segment.words && segment.words.length > 0) {
                  // Render word/gap level boundary elements
                  segment.words.forEach((word: any, wIdx: number) => {
                    const nextWord = segment.words[wIdx + 1];
                    
                    // Boundary between current item and next item
                    if (nextWord) {
                      const leftPercent = (toTimelineTime(word.end) / timelineDuration) * 100;
                      const isDraggingThisBoth = draggingBoundary && typeof draggingBoundary === 'object' && draggingBoundary.type === 'both' && 'wordIdx' in draggingBoundary && draggingBoundary.wordIdx === wIdx;
                      
                      elements.push(
                        <div 
                          key={`cluster-${index}-${wIdx}`} 
                          className="absolute top-0 bottom-0 w-8 -ml-4 z-50 flex justify-center items-center group" 
                          style={{ left: `${leftPercent}%`, ...getCursorStyle('both') }}
                          onMouseDown={(e) => { 
                            e.preventDefault(); 
                            setDraggingBoundary({ type: 'both', segmentIdx: index, wordIdx: wIdx }); 
                          }}
                        >
                          {/* Single double-sided handle dividing the blocks */}
                          <div className={`h-full transition-colors ${isDraggingThisBoth ? 'bg-emerald-400 w-1' : 'bg-accent-blue/40 w-0.5 group-hover:bg-emerald-400 group-hover:w-1'}`} />
                        </div>
                      );
                    }
                  });

                  // Render parent segment boundary handles when zoomed in
                  if (index < editableSegments.length - 1) {
                    const leftPercent = (toTimelineTime(segment.end) / timelineDuration) * 100;
                    const isDraggingThisBoth = draggingBoundary && typeof draggingBoundary === 'object' && draggingBoundary.type === 'both' && 'index' in draggingBoundary && draggingBoundary.index === index;
                    
                    elements.push(
                      <div 
                        key={`parent-cluster-${index}`} 
                        className="absolute top-0 bottom-0 w-8 -ml-4 z-50 flex justify-center items-center group" 
                        style={{ left: `${leftPercent}%`, ...getCursorStyle('both') }}
                        onMouseDown={(e) => { 
                          e.preventDefault(); 
                          setDraggingBoundary({ type: 'both', index }); 
                        }}
                      >
                        <div className={`h-full transition-colors ${isDraggingThisBoth ? 'bg-orange-500 w-1' : 'bg-orange-500/40 w-0.5 group-hover:bg-orange-400 group-hover:w-1'}`} />
                      </div>
                    );
                  } else {
                    // Last parent segment boundary handle
                    const leftPercent = (toTimelineTime(segment.end) / timelineDuration) * 100;
                    elements.push(
                      <div 
                        key={`parent-end-${index}`} 
                        className="absolute top-0 bottom-0 w-8 -ml-4 z-50 flex justify-center items-center group" 
                        style={{ left: `${leftPercent}%`, ...getCursorStyle('left') }}
                        onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary('end'); }}
                      >
                        <div className={`w-0.5 h-full transition-colors ${draggingBoundary === 'end' ? 'bg-orange-500 w-1' : 'bg-orange-500/40 group-hover:bg-orange-400 group-hover:w-1'}`} />
                      </div>
                    );
                  }
                } else if (index < editableSegments.length - 1) {
                  const nextSegment = editableSegments[index + 1];
                  const isTouching = nextSegment.start - segment.end <= 0.05;

                  if (isTouching) {
                    const leftPercent = (toTimelineTime(segment.end) / timelineDuration) * 100;
                    const isDraggingThisBoth = draggingBoundary && typeof draggingBoundary === 'object' && draggingBoundary.type === 'both' && 'index' in draggingBoundary && draggingBoundary.index === index;
                    
                    elements.push(
                      <div key={`cluster-${index}`} className="absolute top-0 bottom-0 w-16 -ml-8 z-30 flex" style={{ left: `${leftPercent}%` }}>
                        <div 
                          className="flex-1 group flex justify-end" 
                          style={getCursorStyle('left')}
                          onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary({ type: 'end', index }); }}
                        >
                          <div className="w-1 h-full bg-transparent group-hover:bg-emerald-400/30 transition-colors" />
                        </div>
                        <div 
                          className="w-2 shrink-0 group flex justify-center items-center relative z-20"
                          style={getCursorStyle('both')}
                          onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary({ type: 'both', index }); }}
                        >
                          <div className={`h-full transition-colors ${isDraggingThisBoth ? 'bg-emerald-400 w-1' : 'bg-accent-blue/40 w-0.5 group-hover:bg-emerald-400 group-hover:w-1'}`} />
                        </div>
                        <div 
                          className="flex-1 group flex justify-start"
                          style={getCursorStyle('right')}
                          onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary({ type: 'start', index: index + 1 }); }}
                        >
                          <div className="w-1 h-full bg-transparent group-hover:bg-emerald-400/30 transition-colors" />
                        </div>
                      </div>
                    );
                  } else {
                    const leftPercent1 = (toTimelineTime(segment.end) / timelineDuration) * 100;
                    const leftPercent2 = (toTimelineTime(nextSegment.start) / timelineDuration) * 100;
                    
                    elements.push(
                      <div 
                        key={`end-${index}`} 
                        className="absolute top-0 bottom-0 w-8 -ml-4 z-30 flex justify-center items-center group" 
                        style={{ left: `${leftPercent1}%`, ...getCursorStyle('left') }}
                        onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary({ type: 'end', index }); }}
                      >
                        <div className="w-0.5 h-full bg-accent-blue/40 transition-colors group-hover:bg-emerald-400 group-hover:w-1" />
                      </div>
                    );
                    
                    elements.push(
                      <div 
                        key={`start-${index + 1}`} 
                        className="absolute top-0 bottom-0 w-8 -ml-4 z-30 flex justify-center items-center group" 
                        style={{ left: `${leftPercent2}%`, ...getCursorStyle('right') }}
                        onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary({ type: 'start', index: index + 1 }); }}
                      >
                        <div className="w-0.5 h-full bg-accent-blue/40 transition-colors group-hover:bg-emerald-400 group-hover:w-1" />
                      </div>
                    );
                  }
                } else {
                  const leftPercent = (toTimelineTime(segment.end) / timelineDuration) * 100;
                  elements.push(
                    <div 
                      key={`end-${index}`} 
                      className="absolute top-0 bottom-0 w-8 -ml-4 z-30 flex justify-center items-center group" 
                      style={{ left: `${leftPercent}%`, ...getCursorStyle('left') }}
                      onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary('end'); }}
                    >
                      <div className={`w-0.5 h-full transition-colors ${draggingBoundary === 'end' ? 'bg-emerald-400 w-1' : 'bg-accent-blue/40 group-hover:bg-emerald-400 group-hover:w-1'}`} />
                    </div>
                  );
                }

                return elements;
              })}
            </>
          )}

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
            {/* The visual line */}
            <div className="w-0.5 h-full bg-red-500 pointer-events-none relative">
              {/* The top handle dot */}
              <div className={`absolute -top-1 -left-1.5 w-3.5 h-3.5 rounded-full transition-transform ${isDraggingPlayhead ? 'bg-red-400 scale-125' : 'bg-red-500 group-hover:scale-125'}`} />
            </div>
          </div>
        </div>
      </div>

      {contextMenu && (
        <div 
          className="fixed bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-lg shadow-xl py-1 z-[9999] text-xs min-w-[150px] animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onPointerDown={(e) => e.stopPropagation()} // Prevent auto-dismiss when clicking items
        >
          <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider border-b border-neutral-800 mb-1">
            {contextMenu.type} Actions
          </div>
          <button 
            onClick={() => {
              handleToggleWordDelete(contextMenu.segmentIdx, contextMenu.wordIdx);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-neutral-800 transition-colors flex items-center gap-2 text-red-400 hover:text-red-300 font-semibold"
          >
            ❌ {contextMenu.isDeleted ? "Restore" : "Delete (Lift)"}
          </button>
          <button 
            onClick={() => {
              const key = contextMenu.type === 'Silence' 
                ? `gap:${contextMenu.segmentIdx}:${contextMenu.wordIdx}` 
                : `word:${contextMenu.segmentIdx}:${contextMenu.wordIdx}`;
              handleRippleDelete([key]);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-neutral-800 transition-colors flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-semibold"
          >
            ✂️ Ripple Delete
          </button>
        </div>
      )}
    </Card>
  );
});

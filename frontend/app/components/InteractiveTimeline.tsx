import { Card } from "@/components/ui/card";
import { memo, useState, useEffect, useRef, useMemo } from "react";
import { SubtitleStyle, DragTarget } from "../types";
import { TimelineControls } from "./timeline/TimelineControls";
import { TimeRuler } from "./timeline/TimeRuler";
import { TimelineBoundaries } from "./timeline/TimelineBoundaries";
import { TimelineContextMenu, ContextMenuData } from "./timeline/TimelineContextMenu";
import { Type, Scissors, Film, MousePointer2 } from "lucide-react";
import { VideoSegment } from "../../hooks/useSubtitleState";

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
  handleRippleDeleteRange: (start: number, end: number) => void;
  setDraggingBoundary: (val: DragTarget | null) => void;
  draggingBoundary: DragTarget | null;
  onSeek: (mediaTime: number, timelineTime: number) => void;
  handleToggleWordDelete: (segmentIndex: number, wordIndex: number) => void;
  videoSegments: VideoSegment[];
  setVideoSegments: React.Dispatch<React.SetStateAction<VideoSegment[]>>;
  selectedVideoIndexes: string[];
  setSelectedVideoIndexes: React.Dispatch<React.SetStateAction<string[]>>;
  cursorMode: 'select' | 'cut';
  handleVideoCut: (time: number) => void;
  setEditableSegments: React.Dispatch<React.SetStateAction<any[]>>;
  setSegmentHistory: React.Dispatch<React.SetStateAction<{ past: any[], future: any[] }>>;
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
  handleRippleDeleteRange,
  setDraggingBoundary,
  draggingBoundary,
  onSeek,
  handleToggleWordDelete,
  videoSegments,
  setVideoSegments,
  selectedVideoIndexes,
  setSelectedVideoIndexes,
  cursorMode,
  handleVideoCut,
  setEditableSegments,
  setSegmentHistory,
}: InteractiveTimelineProps) {
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [draggingVideoBoundary, setDraggingVideoBoundary] = useState<{ id: string; type: 'start' | 'end' | 'body', offsetStart?: number, initialTimelineStart?: number, initialTimelineEnd?: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
  const lastSelectedRef = useRef<number | null>(null);



  const mergedRippleDeletes = useMemo(() => {
    if (!rippleDeletes || rippleDeletes.length === 0) return [];
    const sorted = [...rippleDeletes].sort((a, b) => a.start - b.start);
    const merged = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      const current = sorted[i];
      // Merge if overlapping or adjacent (within a small tolerance)
      if (current.start <= last.end + 0.001) {
        last.end = Math.max(last.end, current.end);
      } else {
        merged.push({ ...current });
      }
    }
    return merged;
  }, [rippleDeletes]);

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
    for (const zone of mergedRippleDeletes) {
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
    for (const zone of mergedRippleDeletes) {
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
      onSeek(toMediaTime(targetTimelineTime), targetTimelineTime);
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
  }, [isDraggingPlayhead, timelineDuration, mediaDuration, trackRef, onSeek, mergedRippleDeletes]);

  // Video Dragging logic
  useEffect(() => {
    if (!draggingVideoBoundary || !trackRef.current) return;
    
    const handleMove = (e: PointerEvent) => {
      const trackRect = trackRef.current!.getBoundingClientRect();
      let clickX = e.clientX - trackRect.left;
      clickX = Math.max(0, Math.min(clickX, trackRect.width));
      const percentage = clickX / trackRect.width;
      const targetTimelineTime = percentage * timelineDuration;
      const newTime = toMediaTime(targetTimelineTime);

      setVideoSegments(prev => prev.map(s => {
        if (s.id === draggingVideoBoundary.id) {
          if (draggingVideoBoundary.type === 'start') {
            const newTimelineStart = Math.max(0, Math.min(newTime, s.timelineEnd - 0.1));
            const delta = newTimelineStart - s.timelineStart;
            return { ...s, timelineStart: newTimelineStart, sourceStart: s.sourceStart + delta };
          } else if (draggingVideoBoundary.type === 'end') {
            const newTimelineEnd = Math.max(s.timelineStart + 0.1, newTime); // Removed Math.min with mediaDuration since timeline can grow indefinitely
            const delta = newTimelineEnd - s.timelineEnd;
            return { ...s, timelineEnd: newTimelineEnd, sourceEnd: s.sourceEnd + delta };
          } else if (draggingVideoBoundary.type === 'body') {
            // Move the whole body
            const delta = newTime - (draggingVideoBoundary.offsetStart || 0);
            const newTimelineStart = Math.max(0, (draggingVideoBoundary.initialTimelineStart || 0) + delta);
            const actualDelta = newTimelineStart - (draggingVideoBoundary.initialTimelineStart || 0);
            const newTimelineEnd = newTimelineStart + ((draggingVideoBoundary.initialTimelineEnd || 0) - (draggingVideoBoundary.initialTimelineStart || 0));
            
            // Shift associated subtitle segments if the video was dragged
            if (Math.abs(actualDelta - (s.timelineStart - (draggingVideoBoundary.initialTimelineStart || 0))) > 0.001) {
                const shiftDiff = actualDelta - (s.timelineStart - (draggingVideoBoundary.initialTimelineStart || 0));
                setEditableSegments(prevEd => prevEd.map(ed => {
                    // Check if subtitle originally fell within this video segment's bounds
                    if (ed.start >= (draggingVideoBoundary.initialTimelineStart || 0) && ed.end <= (draggingVideoBoundary.initialTimelineEnd || 0)) {
                        return {
                            ...ed,
                            start: ed.start + shiftDiff,
                            end: ed.end + shiftDiff,
                            words: ed.words?.map((w: any) => ({
                                ...w,
                                start: w.start + shiftDiff,
                                end: w.end + shiftDiff
                            }))
                        };
                    }
                    return ed;
                }));
            }
            
            return { ...s, timelineStart: newTimelineStart, timelineEnd: newTimelineEnd };
          }
        }
        return s;
      }));
    };

    const handleUp = () => {
      setDraggingVideoBoundary(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [draggingVideoBoundary, timelineDuration, mediaDuration, trackRef, mergedRippleDeletes, setVideoSegments]);

  const handleTrackClick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (e.shiftKey || e.ctrlKey || e.metaKey) return;
    
    setSelectedIndexes([]);
    lastSelectedRef.current = null;

    if ((e.target as HTMLElement).closest('.group')) return;
    
    if (!trackRef.current || timelineDuration <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const targetTimelineTime = percentage * timelineDuration;
    onSeek(toMediaTime(targetTimelineTime), targetTimelineTime);
  };

  const handleTrackContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!trackRef.current || timelineDuration <= 0) return;
    
    // Ignore clicks on items that already have pointer events or own handlers
    if ((e.target as HTMLElement).closest('.pointer-events-auto') || (e.target as HTMLElement).closest('.group')) return;

    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const targetTimelineTime = percentage * timelineDuration;
    const mediaTime = toMediaTime(targetTimelineTime);

    // Find boundaries of this empty space
    let prevSeg = null;
    let nextSeg = null;
    let isInsideSegment = false;
    
    for (const seg of editableSegments) {
      if (mediaTime >= seg.start && mediaTime <= seg.end) {
        isInsideSegment = true;
        break;
      }
      if (seg.end <= mediaTime) prevSeg = seg;
      if (seg.start >= mediaTime && !nextSeg) nextSeg = seg;
    }

    if (isInsideSegment) return;

    const gapStart = prevSeg ? prevSeg.end : 0;
    const gapEnd = nextSeg ? nextSeg.start : mediaDuration;

    if (gapEnd - gapStart > 0.01) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: 'Empty Space',
        segmentIdx: -1,
        wordIdx: -1,
        isDeleted: false,
        gapStart,
        gapEnd,
      });
    }
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
        
        // Anchor zoom to the exact cursor position
        const rect = el.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        
        const anchorOffset = el.scrollLeft + cursorX;
        const currentTrackWidth = trackRef.current ? trackRef.current.scrollWidth : 1;
        const anchorPercentage = anchorOffset / currentTrackWidth;
        
        const newZoom = Math.max(1, Math.min(50, zoomLevel + zoomDelta));
        setZoomLevel(newZoom);
        
        // Wait for render to update track width, then re-center on cursor
        requestAnimationFrame(() => {
          if (trackRef.current) {
            const newTrackWidth = trackRef.current.scrollWidth;
            el.scrollLeft = anchorPercentage * newTrackWidth - cursorX;
          }
        });
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
        currentTime={toTimelineTime(currentTime)}
        mediaDuration={timelineDuration}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
      />

      {/* Scrollable Timeline Container with Headers */}
      <div className={`flex bg-background rounded-xl overflow-hidden h-[120px] ${cursorMode === 'cut' ? 'cursor-none [&_*]:cursor-none' : ''}`}>
        
        {/* Track Headers (Left Panel) */}
        <div className="w-12 shrink-0 bg-neutral-900/50 border-r border-neutral-800 flex flex-col relative z-10 pointer-events-none">
          <div className="absolute top-[28px] w-full flex justify-center text-neutral-500" title="Subtitles">
            <Type className="w-4 h-4" />
          </div>
          <div className="absolute top-[72px] w-full flex justify-center text-neutral-500" title="Video">
            <Film className="w-4 h-4" />
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
          className="relative flex-1 flex overflow-x-auto overflow-y-hidden select-none [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-background [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-accent transition-colors"
        >
        {/* Scaled Inner Track */}
        <div 
          ref={trackRef}
          className="relative h-full cursor-default min-w-full shrink-0"
          style={{ width: `${zoomLevel * 100}%` }}
          onPointerDown={handleTrackClick}
          onContextMenu={handleTrackContextMenu}
          onPointerMove={(e) => {
            if (cursorMode !== 'cut') {
              if (hoverX !== null) setHoverX(null);
              return;
            }
            if (!trackRef.current) return;
            const rect = trackRef.current.getBoundingClientRect();
            let x = e.clientX - rect.left;
            if (timelineDuration > 0) {
              const playheadX = (toTimelineTime(currentTime) / timelineDuration) * rect.width;
              if (Math.abs(x - playheadX) < 15) {
                x = playheadX;
              }
            }
            setHoverX(x);
          }}
          onPointerLeave={() => {
            if (hoverX !== null) setHoverX(null);
          }}
        >
          {/* Time Ticks */}
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGgwLjV2NDBIMHoiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] bg-repeat-x" />

          {/* Thin red line for cut mode cursor */}
          {cursorMode === 'cut' && hoverX !== null && (
            <div 
              className="absolute top-0 bottom-0 w-[1px] bg-red-500 z-50 pointer-events-none"
              style={{ left: `${hoverX}px` }}
            />
          )}

          {/* Dynamic Time Ruler */}
          <TimeRuler timelineDuration={timelineDuration} zoomLevel={zoomLevel} />

          {/* Video Segments blocks */}
          {videoSegments.map((segment) => {
            const tlStart = toTimelineTime(segment.timelineStart);
            const tlEnd = toTimelineTime(segment.timelineEnd);
            // If the segment is completely ripple-deleted, it might have tlStart == tlEnd, so skip rendering if width is 0 or it's hidden
            if (tlStart >= tlEnd) return null;
            
            const left = (tlStart / timelineDuration) * 100;
            const width = ((tlEnd - tlStart) / timelineDuration) * 100;
            const isSelected = selectedVideoIndexes.includes(segment.id);
            
            return (
              <div 
                key={segment.id}
                className={`absolute top-[64px] h-10 rounded text-[10px] p-1 font-medium transition-colors border overflow-hidden ${
                  isSelected
                    ? 'bg-blue-500/30 border-blue-400 z-20 text-blue-100'
                    : segment.deleted
                      ? 'bg-red-950/20 border-red-900/30 text-red-500/60 opacity-60 z-10'
                      : 'bg-indigo-900/40 border-indigo-500/50 text-indigo-200 z-10 hover:border-indigo-400 hover:z-20 cursor-grab active:cursor-grabbing'
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (cursorMode === 'cut') {
                    const rect = trackRef.current!.getBoundingClientRect();
                    let clickX = e.clientX - rect.left;
                    if (timelineDuration > 0) {
                      const playheadX = (toTimelineTime(currentTime) / timelineDuration) * rect.width;
                      if (Math.abs(clickX - playheadX) < 15) {
                        clickX = playheadX;
                      }
                    }
                    const percentage = clickX / rect.width;
                    const targetTimelineTime = percentage * timelineDuration;
                    handleVideoCut(toMediaTime(targetTimelineTime));
                  } else {
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                      setSelectedVideoIndexes(prev => prev.includes(segment.id) ? prev.filter(i => i !== segment.id) : [...prev, segment.id]);
                    } else {
                      setSelectedVideoIndexes([segment.id]);
                    }
                    // Clear subtitle selection when selecting video segments
                    setSelectedIndexes([]);
                    lastSelectedRef.current = null;
                    
                    // Enable body dragging if it's not deleted
                    if (!segment.deleted) {
                      setSegmentHistory((prevHistory) => ({
                        past: [...prevHistory.past, { segments: [...editableSegments], rippleDeletes: [...rippleDeletes], videoSegments: [...videoSegments] }].slice(-50),
                        future: [],
                      }));
                      const rect = trackRef.current!.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const percentage = clickX / rect.width;
                      const targetTimelineTime = percentage * timelineDuration;
                      const offsetStart = toMediaTime(targetTimelineTime);
                      setDraggingVideoBoundary({ id: segment.id, type: 'body', offsetStart, initialTimelineStart: segment.timelineStart, initialTimelineEnd: segment.timelineEnd });
                    }
                  }
                }}
              >
                <div className="truncate relative z-20 pointer-events-none">Video Clip</div>
                
                {/* Drag handles for soft cuts */}
                {cursorMode === 'select' && !segment.deleted && (
                  <>
                    <div 
                      className="absolute top-0 bottom-0 left-0 w-2 cursor-w-resize z-30 hover:bg-white/20 transition-colors"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSegmentHistory((prevHistory) => ({
                          past: [...prevHistory.past, { segments: [...editableSegments], rippleDeletes: [...rippleDeletes], videoSegments: [...videoSegments] }].slice(-50),
                          future: [],
                        }));
                        setDraggingVideoBoundary({ id: segment.id, type: 'start', initialTimelineStart: segment.timelineStart, initialTimelineEnd: segment.timelineEnd });
                      }}
                    />
                    <div 
                      className="absolute top-0 bottom-0 right-0 w-2 cursor-e-resize z-30 hover:bg-white/20 transition-colors"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSegmentHistory((prevHistory) => ({
                          past: [...prevHistory.past, { segments: [...editableSegments], rippleDeletes: [...rippleDeletes], videoSegments: [...videoSegments] }].slice(-50),
                          future: [],
                        }));
                        setDraggingVideoBoundary({ id: segment.id, type: 'end', initialTimelineStart: segment.timelineStart, initialTimelineEnd: segment.timelineEnd });
                      }}
                    />
                  </>
                )}
              </div>
            );
          })}

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
                  // Clear video selection when selecting subtitle segments
                  setSelectedVideoIndexes([]);
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
                // Clear video selection when selecting subtitle words
                setSelectedVideoIndexes([]);
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
                  type: 'Word'
                });
              };

              return (
                <div 
                  key={`track-word-${index}-${wIdx}`} 
                  onPointerDown={selectItem}
                  onContextMenu={handleContextMenu}
                  onDoubleClick={(e) => { e.stopPropagation(); onSeek(word.start, toTimelineTime(word.start)); }}
                  className={`pointer-events-auto absolute top-[20px] h-8 flex items-center justify-center transition-colors z-35 cursor-pointer rounded border ${isDeleted ? 'bg-red-950/70 text-red-400 border-red-900/50 hover:bg-red-900/70 line-through' : selectedIndexes.includes(`word:${index}:${wIdx}`) ? 'bg-emerald-500/40 border-emerald-400 z-40 text-emerald-100' : 'bg-muted/40 border-border hover:border-muted-foreground/50 hover:z-40 text-muted-foreground'}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <span className="truncate w-full text-center text-[9px]">{word.word}</span>
                </div>
              );
            });
          })}



          {/* Draggable Boundaries */}
          <TimelineBoundaries
            zoomLevel={zoomLevel}
            editableSegments={editableSegments}
            toTimelineTime={toTimelineTime}
            timelineDuration={timelineDuration}
            draggingBoundary={draggingBoundary}
            setDraggingBoundary={setDraggingBoundary}
            cursorMode={cursorMode}
          />

          {/* Playhead */}
          <div 
            className={`absolute top-0 bottom-0 w-8 -ml-4 z-20 flex justify-center group ${cursorMode === 'cut' ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'}`}
            style={{ left: `${(toTimelineTime(currentTime) / timelineDuration) * 100}%` }}
            onPointerDown={(e) => {
              if (cursorMode === 'cut') return;
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
        
        {/* Empty space at the end of the timeline */}
        <div className="shrink-0 w-[50vw] h-full pointer-events-none" />
      </div>
    </div>
    
    {contextMenu && (
        <TimelineContextMenu
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          handleToggleWordDelete={handleToggleWordDelete}
          handleRippleDelete={handleRippleDelete}
          handleRippleDeleteRange={handleRippleDeleteRange}
        />
      )}
    </Card>
  );
});

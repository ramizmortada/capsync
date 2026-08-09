import { Card } from "@/components/ui/card";
import { memo, useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
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
  handleVideoDelete?: (ids: string[]) => void;
  handleVideoRippleDelete?: (ids: string[]) => void;
  handleClearTrack: (trackType: 'subtitle' | 'video') => void;
  setDraggingBoundary: (val: DragTarget | null) => void;
  draggingBoundary: DragTarget | null;
  onSeek: (timelineTime: number) => void;
  handleToggleWordDelete: (segmentIndex: number, wordIndex: number) => void;
  videoSegments: VideoSegment[];
  setVideoSegments: React.Dispatch<React.SetStateAction<VideoSegment[]>>;
  selectedVideoIndexes: string[];
  setSelectedVideoIndexes: React.Dispatch<React.SetStateAction<string[]>>;
  cursorMode: 'select' | 'cut' | 'resize';
  setCursorMode?: (mode: 'select' | 'cut' | 'resize') => void;
  handleVideoCut: (time: number) => void;
  handleSubtitleCutAtTime?: (time: number) => void;
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
  handleLiftDelete,
  handleRippleDelete,
  handleRippleDeleteRange,
  handleVideoDelete,
  handleVideoRippleDelete,
  handleClearTrack,
  setDraggingBoundary,
  draggingBoundary,
  onSeek,
  handleToggleWordDelete,
  videoSegments,
  setVideoSegments,
  selectedVideoIndexes,
  setSelectedVideoIndexes,
  cursorMode,
  setCursorMode,
  handleVideoCut,
  handleSubtitleCutAtTime,
  setEditableSegments,
  setSegmentHistory,
}: InteractiveTimelineProps) {
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [draggingVideoBoundary, setDraggingVideoBoundary] = useState<{ id: string; type: 'start' | 'end' | 'body', offsetStart?: number, initialTimelineStart?: number, initialTimelineEnd?: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const zoomAnchorRef = useRef({ percentage: 0, cursorX: 0, targetZoom: 0 });
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
    const activeSeg = videoSegments.find(s => mediaTime >= s.sourceStart && mediaTime <= s.sourceEnd && !s.deleted);
    if (activeSeg) {
      return activeSeg.timelineStart + (mediaTime - activeSeg.sourceStart);
    }
    const closest = [...videoSegments].filter(s => !s.deleted).sort((a, b) => Math.abs(a.sourceStart - mediaTime) - Math.abs(b.sourceStart - mediaTime))[0];
    if (closest) {
      return closest.timelineStart + (mediaTime - closest.sourceStart);
    }
    return mediaTime;
  };

  const toMediaTime = (timelineTime: number) => {
    const activeSeg = videoSegments.find(s => timelineTime >= s.timelineStart && timelineTime <= s.timelineEnd && !s.deleted);
    if (activeSeg) {
      return activeSeg.sourceStart + (timelineTime - activeSeg.timelineStart);
    }
    const closest = [...videoSegments].filter(s => !s.deleted).sort((a, b) => Math.abs(a.timelineStart - timelineTime) - Math.abs(b.timelineStart - timelineTime))[0];
    if (closest) {
      return closest.sourceStart + (timelineTime - closest.timelineStart);
    }
    return timelineTime;
  };

  // Check if a source-time range overlaps any active (non-deleted) video segment
  const isInActiveVideoRange = (start: number, end: number) => {
    return videoSegments.some(s => !s.deleted && start < s.sourceEnd && end > s.sourceStart);
  };

  let calculatedTimelineDur = videoSegments.reduce((max, s) => s.deleted ? max : Math.max(max, s.timelineEnd), 0);
  if (calculatedTimelineDur === 0 && mediaDuration > 0) calculatedTimelineDur = mediaDuration;
  const timelineDuration = Math.max(calculatedTimelineDur, 0.1);

  useEffect(() => {
    if (!isDraggingPlayhead || !trackRef.current) return;
    
    const handleMove = (e: PointerEvent) => {
      const trackRect = trackRef.current!.getBoundingClientRect();
      let clickX = e.clientX - trackRect.left;
      clickX = Math.max(0, Math.min(clickX, trackRect.width));
      const percentage = clickX / trackRect.width;
      const targetTimelineTime = percentage * timelineDuration;
      onSeek(targetTimelineTime);
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

      setVideoSegments(prev => {
        const SNAP_THRESHOLD = 0.2; // 0.2 seconds
        const activeOthers = prev.filter(o => o.id !== draggingVideoBoundary.id && !o.deleted).sort((a, b) => a.timelineStart - b.timelineStart);

        return prev.map(s => {
          if (s.id === draggingVideoBoundary.id) {
            if (draggingVideoBoundary.type === 'start') {
              const prevSeg = activeOthers.filter(o => o.timelineEnd <= s.timelineEnd).sort((a, b) => b.timelineEnd - a.timelineEnd)[0];
              const minStart = prevSeg ? prevSeg.timelineEnd : 0;
              let newTimelineStart = Math.max(minStart, Math.min(targetTimelineTime, s.timelineEnd - 0.1));
              
              if (Math.abs(newTimelineStart - minStart) < SNAP_THRESHOLD) {
                newTimelineStart = minStart;
              }

              const delta = newTimelineStart - s.timelineStart;
              return { ...s, timelineStart: newTimelineStart, sourceStart: s.sourceStart + delta };
            } else if (draggingVideoBoundary.type === 'end') {
              const nextSeg = activeOthers.filter(o => o.timelineStart >= s.timelineStart).sort((a, b) => a.timelineStart - b.timelineStart)[0];
              const maxEnd = nextSeg ? nextSeg.timelineStart : timelineDuration + 3600;
              let newTimelineEnd = Math.max(s.timelineStart + 0.1, Math.min(targetTimelineTime, maxEnd));

              if (nextSeg && Math.abs(newTimelineEnd - nextSeg.timelineStart) < SNAP_THRESHOLD) {
                newTimelineEnd = nextSeg.timelineStart;
              }

              const delta = newTimelineEnd - s.timelineEnd;
              return { ...s, timelineEnd: newTimelineEnd, sourceEnd: s.sourceEnd + delta };
            } else if (draggingVideoBoundary.type === 'body') {
              const dur = (draggingVideoBoundary.initialTimelineEnd || 0) - (draggingVideoBoundary.initialTimelineStart || 0);
              const delta = targetTimelineTime - (draggingVideoBoundary.offsetStart || 0);
              const desiredStart = Math.max(0, (draggingVideoBoundary.initialTimelineStart || 0) + delta);

              const hasOverlap = (testStart: number) => {
                const testEnd = testStart + dur;
                return activeOthers.some(o => testStart < o.timelineEnd - 0.001 && testEnd > o.timelineStart + 0.001);
              };

              let newTimelineStart = desiredStart;

              if (hasOverlap(desiredStart)) {
                const candidates: number[] = [];
                if (!hasOverlap(0)) candidates.push(0);

                for (const o of activeOthers) {
                  if (!hasOverlap(o.timelineEnd)) candidates.push(o.timelineEnd);
                  const beforeStart = o.timelineStart - dur;
                  if (beforeStart >= 0 && !hasOverlap(beforeStart)) candidates.push(beforeStart);
                }

                if (candidates.length > 0) {
                  candidates.sort((a, b) => Math.abs(a - desiredStart) - Math.abs(b - desiredStart));
                  newTimelineStart = candidates[0];
                } else {
                  newTimelineStart = s.timelineStart;
                }
              } else {
                // Apply snapping if no overlap
                if (Math.abs(newTimelineStart - 0) < SNAP_THRESHOLD && !hasOverlap(0)) {
                  newTimelineStart = 0;
                } else {
                  for (const o of activeOthers) {
                    if (Math.abs(newTimelineStart - o.timelineEnd) < SNAP_THRESHOLD && !hasOverlap(o.timelineEnd)) {
                      newTimelineStart = o.timelineEnd;
                      break;
                    }
                    if (Math.abs((newTimelineStart + dur) - o.timelineStart) < SNAP_THRESHOLD && !hasOverlap(o.timelineStart - dur)) {
                      newTimelineStart = o.timelineStart - dur;
                      break;
                    }
                  }
                }
              }

              return { ...s, timelineStart: newTimelineStart, timelineEnd: newTimelineStart + dur };
            }
          }
          return s;
        });
      });
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

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.group') || (e.target as HTMLElement).closest('.pointer-events-auto')) return;
    if (!trackRef.current || timelineDuration <= 0) return;

    const trackRect = trackRef.current.getBoundingClientRect();
    const startX = e.clientX - trackRect.left;
    const startY = e.clientY - trackRect.top;

    let hasDragged = false;
    const initialSelectedIndexes = (e.shiftKey || e.ctrlKey || e.metaKey) ? [...selectedIndexes] : [];

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!trackRef.current) return;
      const currentX = moveEvent.clientX - trackRect.left;
      const currentY = moveEvent.clientY - trackRect.top;

      const distance = Math.hypot(currentX - startX, currentY - startY);
      if (distance > 5) {
        hasDragged = true;

        const boxMinX = Math.min(startX, currentX);
        const boxMaxX = Math.max(startX, currentX);
        const boxMinY = Math.min(startY, currentY);
        const boxMaxY = Math.max(startY, currentY);

        setMarqueeBox({
          startX: boxMinX,
          startY: boxMinY,
          currentX: boxMaxX,
          currentY: boxMaxY,
        });

        if (cursorMode === 'select' || cursorMode === 'resize') {
          const minPercentage = boxMinX / trackRect.width;
          const maxPercentage = boxMaxX / trackRect.width;

          const minTime = minPercentage * timelineDuration;
          const maxTime = maxPercentage * timelineDuration;

          const minMediaTime = toMediaTime(minTime);
          const maxMediaTime = toMediaTime(maxTime);

          const newlySelected: number[] = [];
          editableSegments.forEach((seg, idx) => {
            if (seg.start <= maxMediaTime && seg.end >= minMediaTime) {
              newlySelected.push(idx);
            }
          });

          const combined = Array.from(new Set([...initialSelectedIndexes, ...newlySelected]));
          setSelectedIndexes(combined);
        }
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      setMarqueeBox(null);

      if (!hasDragged) {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          setSelectedIndexes([]);
          lastSelectedRef.current = null;
        }
        const percentage = startX / trackRect.width;
        const targetTimelineTime = percentage * timelineDuration;
        onSeek(targetTimelineTime);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
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

    let prevSeg = null;
    let nextSeg = null;
    let isInsideSegment = false;
    
    for (const seg of editableSegments) {
      const segTlStart = toTimelineTime(seg.start);
      const segTlEnd = toTimelineTime(seg.end);
      if (targetTimelineTime >= segTlStart && targetTimelineTime <= segTlEnd) {
        isInsideSegment = true;
        break;
      }
      if (seg.end <= mediaTime) {
        if (!prevSeg || seg.end > prevSeg.end) prevSeg = seg;
      }
      if (seg.start >= mediaTime) {
        if (!nextSeg || seg.start < nextSeg.start) nextSeg = seg;
      }
    }

    for (const vSeg of videoSegments) {
      if (vSeg.deleted) continue;
      if (targetTimelineTime >= vSeg.timelineStart && targetTimelineTime <= vSeg.timelineEnd) {
        isInsideSegment = true;
        break;
      }
    }

    if (isInsideSegment) return;

    const gapStart = prevSeg ? prevSeg.end : 0;
    const gapEnd = nextSeg ? nextSeg.start : mediaDuration;

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'Empty Space',
      segmentIdx: -1,
      wordIdx: -1,
      isDeleted: false,
      gapStart,
      gapEnd,
      insertTime: mediaTime,
    });
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
        
        // Save the anchor for the useLayoutEffect to apply after DOM update
        zoomAnchorRef.current = {
          percentage: anchorPercentage,
          cursorX,
          targetZoom: newZoom
        };
        
        setZoomLevel(newZoom);
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

  // Synchronously update scroll position after zoom changes the DOM
  useLayoutEffect(() => {
    if (zoomAnchorRef.current.targetZoom === zoomLevel && timelineRef.current && trackRef.current) {
      const { percentage, cursorX } = zoomAnchorRef.current;
      const newTrackWidth = trackRef.current.scrollWidth;
      timelineRef.current.scrollLeft = percentage * newTrackWidth - cursorX;
    }
  }, [zoomLevel]);

  return (
    <Card className="bg-card border-border shadow-2xl p-2">
      <TimelineControls
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        stopPlay={stopPlay}
        currentTime={currentTime}
        mediaDuration={timelineDuration}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        cursorMode={cursorMode}
        setCursorMode={setCursorMode}
      />

      {/* Scrollable Timeline Container with Headers */}
      <div className={`flex bg-background rounded-xl overflow-hidden h-[120px] ${
        cursorMode === 'cut' ? 'cursor-none [&_*]:cursor-none' : ''
      }`}>
        
        {/* Track Headers (Left Panel) */}
        <div className="w-12 shrink-0 bg-neutral-900/50 border-r border-neutral-800 flex flex-col relative z-10 select-none">
          <div 
            className="absolute top-[28px] w-full flex justify-center text-neutral-500 hover:text-neutral-300 cursor-context-menu" 
            title="Subtitles (Right click to clear)"
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, type: 'Subtitle Track' });
            }}
          >
            <Type className="w-4 h-4" />
          </div>
          <div 
            className="absolute top-[72px] w-full flex justify-center text-neutral-500 hover:text-neutral-300 cursor-context-menu" 
            title="Video (Right click to clear)"
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, type: 'Video Track' });
            }}
          >
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
          onPointerDown={handleTrackPointerDown}
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
              const playheadX = (currentTime / timelineDuration) * rect.width;
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

          {/* Floating red line & Scissor Icon badge for cut mode */}
          {cursorMode === 'cut' && hoverX !== null && (
            <>
              <div 
                className="absolute top-0 bottom-0 w-[1.5px] bg-red-500 z-50 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                style={{ left: `${hoverX}px` }}
              />
              <div 
                className="absolute top-1 z-50 pointer-events-none -ml-3 bg-red-600 text-white p-1 rounded-full shadow-lg border border-white/40 ring-2 ring-red-500/50"
                style={{ left: `${hoverX}px` }}
              >
                <Scissors className="w-3.5 h-3.5 -rotate-90" />
              </div>
            </>
          )}

          {/* Dynamic Time Ruler */}
          <TimeRuler timelineDuration={timelineDuration} zoomLevel={zoomLevel} />

          {/* Video Segments blocks */}
          {videoSegments.map((segment) => {
            if (segment.deleted) return null;
            const left = (segment.timelineStart / timelineDuration) * 100;
            const width = ((segment.timelineEnd - segment.timelineStart) / timelineDuration) * 100;
            if (width <= 0) return null;
            const isSelected = selectedVideoIndexes.includes(segment.id);
            
            return (
              <div 
                key={segment.id}
                className={`absolute top-[64px] h-10 rounded text-[10px] p-1 font-medium transition-colors border overflow-hidden ${
                  isSelected
                    ? 'bg-blue-500/30 border-blue-400 z-20 text-blue-100'
                    : 'bg-indigo-900/40 border-indigo-500/50 text-indigo-200 z-10 hover:border-indigo-400 hover:z-20 cursor-grab active:cursor-grabbing'
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedVideoIndexes([segment.id]);
                  setSelectedIndexes([]);
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    type: 'Video Segment',
                    videoSegmentId: segment.id,
                  });
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (cursorMode === 'cut') {
                    const rect = trackRef.current!.getBoundingClientRect();
                    let clickX = e.clientX - rect.left;
                    if (timelineDuration > 0) {
                      const playheadX = (currentTime / timelineDuration) * rect.width;
                      if (Math.abs(clickX - playheadX) < 15) {
                        clickX = playheadX;
                      }
                    }
                    const percentage = clickX / rect.width;
                    const targetTimelineTime = percentage * timelineDuration;
                    handleVideoCut(targetTimelineTime);
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
                      const offsetStart = targetTimelineTime;
                      setDraggingVideoBoundary({ id: segment.id, type: 'body', offsetStart, initialTimelineStart: segment.timelineStart, initialTimelineEnd: segment.timelineEnd });
                    }
                  }
                }}
              >
                <div className="truncate relative z-20 pointer-events-none">Video Clip</div>
                
                {/* Drag handles for soft cuts */}
                {cursorMode === 'resize' && !segment.deleted && (
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
            if (tlStart >= tlEnd) return null;
            if (!isInActiveVideoRange(segment.start, segment.end)) return null;

            const left = (tlStart / timelineDuration) * 100;
            const width = ((tlEnd - tlStart) / timelineDuration) * 100;
            if (width <= 0) return null;

            const isActive = currentTime >= (tlStart - 0.05) && currentTime < (tlEnd - 0.05);
            
            const realWords = segment.words ? segment.words.filter((w: any) => !w.isGap) : [];
            const isSilenced = realWords.length > 0 && realWords.every((w: any) => w.deleted);
            const isSelected = selectedIndexes.includes(index);
            
            return (
              <div 
                key={index}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedIndexes([index]);
                  setSelectedVideoIndexes([]);
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    type: 'Subtitle Segment',
                    segmentIdx: index,
                  });
                }}
                onPointerDown={(e) => {
                  if (zoomLevel >= 15) return; // Parent is intangible when zoomed in
                  e.stopPropagation();
                  if (cursorMode === 'cut') {
                    if (trackRef.current && timelineDuration > 0) {
                      const rect = trackRef.current.getBoundingClientRect();
                      let clickX = e.clientX - rect.left;
                      const playheadX = (currentTime / timelineDuration) * rect.width;
                      if (Math.abs(clickX - playheadX) < 15) {
                        clickX = playheadX;
                      }
                      const percentage = clickX / rect.width;
                      const targetTimelineTime = percentage * timelineDuration;
                      if (handleSubtitleCutAtTime) {
                        handleSubtitleCutAtTime(targetTimelineTime);
                      }
                    }
                    return;
                  }
                  // Clear video selection when selecting subtitle segments
                  setSelectedVideoIndexes([]);
                  if (trackRef.current && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                    const rect = trackRef.current.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const clickTimelineTime = (clickX / rect.width) * timelineDuration;
                    setDraggingBoundary({
                      type: 'body',
                      index,
                      initialStart: segment.start,
                      initialEnd: segment.end,
                      dragOffset: toMediaTime(clickTimelineTime) - segment.start
                    });
                  }
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
                    if (!selectedIndexes.includes(index)) {
                      setSelectedIndexes([index]);
                      lastSelectedRef.current = index;
                    }
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
              if (tlStart >= tlEnd) return null;
              if (!isInActiveVideoRange(word.start, word.end)) return null;
              const left = (tlStart / timelineDuration) * 100;
              const width = ((tlEnd - tlStart) / timelineDuration) * 100;
              if (width <= 0) return null;
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
                  onDoubleClick={(e) => { e.stopPropagation(); onSeek(toTimelineTime(word.start)); }}
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
            style={{ left: `${(currentTime / timelineDuration) * 100}%` }}
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

          {/* Marquee Selection Box Overlay */}
          {marqueeBox && (
            <div 
              className="absolute z-50 pointer-events-none bg-blue-500/20 border border-blue-400/70 rounded shadow-sm transition-none"
              style={{
                left: `${marqueeBox.startX}px`,
                top: `${marqueeBox.startY}px`,
                width: `${marqueeBox.currentX - marqueeBox.startX}px`,
                height: `${marqueeBox.currentY - marqueeBox.startY}px`,
              }}
            />
          )}
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
          handleVideoRippleDelete={handleVideoRippleDelete}
          handleVideoDelete={handleVideoDelete}
          handleLiftDelete={handleLiftDelete}
          handleClearTrack={handleClearTrack}
          handleInsertSubtitle={(time: number) => {
            setSegmentHistory((prev: any) => ({
              past: [...prev.past, { segments: [...editableSegments], rippleDeletes: [...rippleDeletes], videoSegments: [...videoSegments] }].slice(-50),
              future: [],
            }));
            const newSegment = {
              start: time,
              end: time + 1,
              text: "New Subtitle",
              words: [
                {
                  word: "New Subtitle",
                  start: time,
                  end: time + 1,
                  deleted: false,
                  isGap: false
                }
              ]
            };
            setEditableSegments((prev: any[]) => {
              const newSegments = [...prev, newSegment];
              newSegments.sort((a, b) => a.start - b.start);
              return newSegments;
            });
          }}
        />
      )}
    </Card>
  );
});

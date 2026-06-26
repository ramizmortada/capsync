import { ZoomIn, ZoomOut, Play, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { memo, useState, useEffect } from "react";
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
  handleTrackClick: (e: React.PointerEvent<HTMLDivElement>) => void;
  editableSegments: any[];
  setDraggingBoundary: (val: DragTarget | null) => void;
  draggingBoundary: DragTarget | null;
  onSeek: (time: number) => void;
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
  handleTrackClick,
  editableSegments,
  setDraggingBoundary,
  draggingBoundary,
  onSeek,
}: InteractiveTimelineProps) {
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  useEffect(() => {
    if (!isDraggingPlayhead || !trackRef.current) return;
    
    const handleMove = (e: PointerEvent) => {
      const trackRect = trackRef.current!.getBoundingClientRect();
      let clickX = e.clientX - trackRect.left;
      clickX = Math.max(0, Math.min(clickX, trackRect.width));
      const percentage = clickX / trackRect.width;
      onSeek(percentage * mediaDuration);
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
  }, [isDraggingPlayhead, mediaDuration, trackRef, onSeek]);

  const duration = Math.max(mediaDuration, 0.1);
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
            max="10" 
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
        onWheel={() => {
          isHoveringTimeline.current = true;
          clearTimeout((timelineRef as any)._timeout);
          (timelineRef as any)._timeout = setTimeout(() => isHoveringTimeline.current = false, 1000);
        }}
        onPointerDown={() => {
          isHoveringTimeline.current = true;
          clearTimeout((timelineRef as any)._timeout);
        }}
        onPointerUp={() => {
          (timelineRef as any)._timeout = setTimeout(() => isHoveringTimeline.current = false, 1000);
        }}
        className="relative h-24 bg-background rounded-xl overflow-x-auto overflow-y-hidden select-none [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-background [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-accent transition-colors"
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

          {/* Dynamic Time Ruler */}
          {(() => {
            if (mediaDuration <= 0) return null;
            // Determine interval based on zoom to keep ruler readable
            let intervalSeconds = 5;
            if (zoomLevel >= 4) intervalSeconds = 1;
            else if (zoomLevel >= 2) intervalSeconds = 2;
            else if (mediaDuration > 300) intervalSeconds = 15; // Zoomed out on long video
            else if (mediaDuration > 60) intervalSeconds = 10;
            
            const numTicks = Math.floor(mediaDuration / intervalSeconds);
            const ticks = Array.from({ length: numTicks + 1 }, (_, i) => i * intervalSeconds);
            
            return ticks.map(tick => {
              const leftPercent = (tick / mediaDuration) * 100;
              return (
                <div key={`tick-${tick}`} className="absolute top-0 text-[10px] text-neutral-500 pointer-events-none transform -translate-x-1/2" style={{ left: `${leftPercent}%` }}>
                  {formatUiTime(tick)}
                </div>
              );
            });
          })()}

          {/* Subtitle Segments blocks */}
          {editableSegments.map((segment, index) => {
            const left = (segment.start / mediaDuration) * 100;
            const width = ((segment.end - segment.start) / mediaDuration) * 100;
            const isActive = currentTime >= (segment.start - 0.05) && currentTime < (segment.end - 0.05);
            
            return (
              <div 
                key={index}
                className={`absolute top-6 bottom-2 rounded text-[10px] p-1 font-medium overflow-hidden transition-colors border pointer-events-none ${
                  isActive 
                    ? 'bg-accent-blue/30 border-accent-blue/50 text-blue-100 shadow-accent-blue/30 shadow-[0_0_10px]' 
                    : 'bg-muted/40 border-border text-muted-foreground'
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                <div className="truncate">{segment.text}</div>
              </div>
            );
          })}

          {/* Draggable Boundaries */}
          
          {/* First segment start boundary */}
          {editableSegments.length > 0 && (
            <div
              onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary('start'); }}
              className="absolute top-0 bottom-0 w-8 -ml-4 z-10 flex justify-center items-center group"
              style={{ left: `${(editableSegments[0].start / duration) * 100}%`, ...getCursorStyle('right') }}
            >
              <div className={`w-0.5 h-full transition-colors ${draggingBoundary === 'start' ? 'bg-emerald-400 w-1 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-accent-blue/40 group-hover:bg-emerald-400 group-hover:w-1'}`} />
            </div>
          )}

          {/* Boundaries for segments */}
          {editableSegments.map((segment, index) => {
            const elements = [];

            if (index < editableSegments.length - 1) {
              const nextSegment = editableSegments[index + 1];
              const isTouching = nextSegment.start - segment.end <= 0.05;

              if (isTouching) {
                // Render 3-zone cluster at segment.end
                const leftPercent = (segment.end / duration) * 100;
                const isDraggingThisBoth = draggingBoundary && typeof draggingBoundary === 'object' && draggingBoundary.type === 'both' && draggingBoundary.index === index;
                
                elements.push(
                  <div key={`cluster-${index}`} className="absolute top-0 bottom-0 w-16 -ml-8 z-10 flex" style={{ left: `${leftPercent}%` }}>
                    {/* Left Zone (End of segment i) */}
                    <div 
                      className="flex-1 group flex justify-end" 
                      style={getCursorStyle('left')}
                      onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary({ type: 'end', index }); }}
                    >
                      <div className="w-1 h-full bg-transparent group-hover:bg-emerald-400/30 transition-colors" />
                    </div>
                    {/* Center Zone (Both) */}
                    <div 
                      className="w-6 flex justify-center items-center group"
                      style={getCursorStyle('both')}
                      onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary({ type: 'both', index }); }}
                    >
                      <div className={`w-0.5 h-full transition-colors ${isDraggingThisBoth ? 'bg-emerald-400 w-1 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-accent-blue/40 group-hover:bg-emerald-400 group-hover:w-1'}`} />
                    </div>
                    {/* Right Zone (Start of segment i+1) */}
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
                // Gap exists! Render two independent handles.
                const isDraggingEnd = draggingBoundary && typeof draggingBoundary === 'object' && draggingBoundary.type === 'end' && draggingBoundary.index === index;
                elements.push(
                  <div
                    key={`end-${index}`}
                    onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary({ type: 'end', index }); }}
                    className="absolute top-0 bottom-0 w-8 -ml-4 z-10 flex justify-center items-center group"
                    style={{ left: `${(segment.end / duration) * 100}%`, ...getCursorStyle('left') }}
                  >
                    <div className={`w-0.5 h-full transition-colors ${isDraggingEnd ? 'bg-emerald-400 w-1 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-accent-blue/40 group-hover:bg-emerald-400 group-hover:w-1'}`} />
                  </div>
                );
                
                const isDraggingStart = draggingBoundary && typeof draggingBoundary === 'object' && draggingBoundary.type === 'start' && draggingBoundary.index === index + 1;
                elements.push(
                  <div
                    key={`start-${index + 1}`}
                    onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary({ type: 'start', index: index + 1 }); }}
                    className="absolute top-0 bottom-0 w-8 -ml-4 z-10 flex justify-center items-center group"
                    style={{ left: `${(nextSegment.start / duration) * 100}%`, ...getCursorStyle('right') }}
                  >
                    <div className={`w-0.5 h-full transition-colors ${isDraggingStart ? 'bg-emerald-400 w-1 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-accent-blue/40 group-hover:bg-emerald-400 group-hover:w-1'}`} />
                  </div>
                );
              }
            } else {
              // Very last segment end boundary
              elements.push(
                <div
                  key="last-end"
                  onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary('end'); }}
                  className="absolute top-0 bottom-0 w-8 -ml-4 z-10 flex justify-center items-center group"
                  style={{ left: `${(segment.end / duration) * 100}%`, ...getCursorStyle('left') }}
                >
                  <div className={`w-0.5 h-full transition-colors ${draggingBoundary === 'end' ? 'bg-emerald-400 w-1 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-accent-blue/40 group-hover:bg-emerald-400 group-hover:w-1'}`} />
                </div>
              );
            }

            return elements;
          })}

          {/* Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-8 -ml-4 z-20 flex justify-center cursor-grab active:cursor-grabbing group"
            style={{ left: `${(currentTime / duration) * 100}%` }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingPlayhead(true);
            }}
          >
            {/* The visual line */}
            <div className="w-0.5 h-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] pointer-events-none relative">
              {/* The top handle dot */}
              <div className={`absolute -top-1 -left-1.5 w-3.5 h-3.5 rounded-full transition-transform ${isDraggingPlayhead ? 'bg-red-400 scale-125' : 'bg-red-500 group-hover:scale-125'}`} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
});

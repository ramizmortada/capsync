import { ZoomIn, ZoomOut, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatUiTime } from "@/lib/utils";

interface InteractiveTimelineProps {
  isPlaying: boolean;
  togglePlay: () => void;
  currentTime: number;
  mediaDuration: number;
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  isHoveringTimeline: React.MutableRefObject<boolean>;
  trackRef: React.RefObject<HTMLDivElement | null>;
  handleTrackClick: (e: React.PointerEvent<HTMLDivElement>) => void;
  editableSegments: any[];
  setDraggingBoundary: (val: number | 'start' | 'end' | null) => void;
  draggingBoundary: number | 'start' | 'end' | null;
}

export function InteractiveTimeline({
  isPlaying,
  togglePlay,
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
}: InteractiveTimelineProps) {
  return (
    <Card className="bg-neutral-900 border-neutral-800 shadow-2xl p-2">
      {/* Timeline Header (Controls) */}
      <div className="flex items-center justify-between px-2 mb-2 gap-4">
        
        {/* Play Controls */}
        <div className="flex items-center gap-3">
          <Button 
            onClick={togglePlay} 
            variant="ghost"
            size="icon" 
            className="rounded-full shrink-0 text-neutral-300 hover:text-white hover:bg-white/10"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-1 fill-current" />}
          </Button>
          <div className="text-xs font-mono text-neutral-400 bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800 tracking-widest hidden sm:block">
            {formatUiTime(currentTime)} / {formatUiTime(mediaDuration)}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-3 w-48 bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800">
          <ZoomOut className="w-4 h-4 text-neutral-500" />
          <input 
            type="range" 
            min="1" 
            max="10" 
            step="0.5" 
            value={zoomLevel} 
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
          />
          <ZoomIn className="w-4 h-4 text-neutral-500" />
        </div>
      </div>

      {/* Scrollable Timeline Container */}
      <div 
        ref={timelineRef}
        onMouseEnter={() => isHoveringTimeline.current = true}
        onMouseLeave={() => isHoveringTimeline.current = false}
        className="relative h-24 bg-neutral-950 rounded-xl overflow-x-auto overflow-y-hidden select-none [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-neutral-950 [&::-webkit-scrollbar-thumb]:bg-neutral-800 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-700 transition-colors"
      >
        {/* Scaled Inner Track */}
        <div 
          ref={trackRef}
          className="relative h-full cursor-crosshair min-w-full"
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
            const isActive = currentTime >= segment.start && currentTime <= segment.end;
            
            return (
              <div 
                key={index}
                className={`absolute top-6 bottom-2 rounded text-[10px] p-1 font-medium overflow-hidden transition-colors border pointer-events-none ${
                  isActive 
                    ? 'bg-blue-500/30 border-blue-400/50 text-blue-100 shadow-[0_0_10px_rgba(59,130,246,0.3)]' 
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                <div className="truncate">{segment.text}</div>
              </div>
            );
          })}

          {/* Draggable Boundaries */}
          
          {/* Start Boundary */}
          {editableSegments.length > 0 && (
            <div
              onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary('start'); }}
              className="absolute top-0 bottom-0 w-4 -ml-2 cursor-col-resize z-10 flex justify-center items-center group"
              style={{ left: `${(editableSegments[0].start / mediaDuration) * 100}%` }}
            >
              <div className={`w-0.5 h-full transition-colors ${draggingBoundary === 'start' ? 'bg-emerald-400 w-1 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-blue-400/50 group-hover:bg-emerald-400 group-hover:w-1'}`} />
            </div>
          )}

          {/* End Boundary */}
          {editableSegments.length > 0 && (
            <div
              onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary('end'); }}
              className="absolute top-0 bottom-0 w-4 -ml-2 cursor-col-resize z-10 flex justify-center items-center group"
              style={{ left: `${(editableSegments[editableSegments.length - 1].end / mediaDuration) * 100}%` }}
            >
              <div className={`w-0.5 h-full transition-colors ${draggingBoundary === 'end' ? 'bg-emerald-400 w-1 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-blue-400/50 group-hover:bg-emerald-400 group-hover:w-1'}`} />
            </div>
          )}

          {/* Shared Boundaries */}
          {editableSegments.map((segment, index) => {
            // The boundary is the END of the current segment
            if (index === editableSegments.length - 1) return null; // Last segment has no right boundary to drag
            
            const left = (segment.end / mediaDuration) * 100;
            
            return (
              <div
                key={`boundary-${index}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDraggingBoundary(index);
                }}
                className="absolute top-0 bottom-0 w-4 -ml-2 cursor-col-resize z-10 flex justify-center items-center group"
                style={{ left: `${left}%` }}
              >
                {/* Visual indicator on hover/drag */}
                <div className={`w-0.5 h-full transition-colors ${
                  draggingBoundary === index 
                    ? 'bg-emerald-400 w-1 shadow-[0_0_10px_rgba(52,211,153,0.8)]' 
                    : 'bg-neutral-600 group-hover:bg-emerald-400 group-hover:w-1'
                }`} />
              </div>
            );
          })}

          {/* Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] z-20 pointer-events-none"
            style={{ left: `${(currentTime / mediaDuration) * 100}%` }}
          >
            <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-red-500 rounded-full" />
          </div>
        </div>
      </div>
    </Card>
  );
}

import { ZoomIn, ZoomOut, Play, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatUiTime } from "@/lib/utils";

interface TimelineControlsProps {
  isPlaying: boolean;
  togglePlay: () => void;
  stopPlay: () => void;
  currentTime: number;
  mediaDuration: number;
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
}

export const TimelineControls = ({
  isPlaying,
  togglePlay,
  stopPlay,
  currentTime,
  mediaDuration,
  zoomLevel,
  setZoomLevel,
}: TimelineControlsProps) => {
  return (
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
  );
};

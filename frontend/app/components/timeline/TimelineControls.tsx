import { ZoomIn, ZoomOut, Play, Pause, Square, MousePointer, Scissors, MoveHorizontal } from "lucide-react";
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
  cursorMode?: 'select' | 'cut' | 'resize';
  setCursorMode?: (mode: 'select' | 'cut' | 'resize') => void;
}

export const TimelineControls = ({
  isPlaying,
  togglePlay,
  stopPlay,
  currentTime,
  mediaDuration,
  zoomLevel,
  setZoomLevel,
  cursorMode = 'select',
  setCursorMode,
}: TimelineControlsProps) => {
  return (
    <div className="flex items-center justify-between px-2 mb-2 gap-4 select-none">
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
        <div className="ml-2 text-xs font-mono text-muted-foreground bg-background px-3 py-1 rounded-lg border border-border tracking-widest hidden sm:block">
          {formatUiTime(currentTime)} / {formatUiTime(mediaDuration)}
        </div>
      </div>

      {/* Tool Mode Buttons (Select, Cut, Resize) */}
      {setCursorMode && (
        <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border">
          <Button
            variant={cursorMode === 'select' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setCursorMode('select')}
            className={`h-7 px-2.5 gap-1.5 text-xs font-medium transition-all ${
              cursorMode === 'select' 
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Select Tool (Press key V)"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Select (V)</span>
          </Button>

          <Button
            variant={cursorMode === 'cut' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setCursorMode(cursorMode === 'cut' ? 'select' : 'cut')}
            className={`h-7 px-2.5 gap-1.5 text-xs font-medium transition-all ${
              cursorMode === 'cut' 
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-sm animate-pulse' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Cut / Scissor Tool (Press key C)"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cut (C)</span>
          </Button>

          <Button
            variant={cursorMode === 'resize' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setCursorMode(cursorMode === 'resize' ? 'select' : 'resize')}
            className={`h-7 px-2.5 gap-1.5 text-xs font-medium transition-all ${
              cursorMode === 'resize' 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Resize / Trim Tool (Press key S)"
          >
            <MoveHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Resize (S)</span>
          </Button>
        </div>
      )}

      {/* Zoom Controls */}
      <div className="flex items-center gap-3 w-44 bg-background px-3 py-1 rounded-lg border border-border">
        <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
        <input 
          type="range" 
          min="1" 
          max="50" 
          step="0.5" 
          value={zoomLevel} 
          onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
          className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
        />
        <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
    </div>
  );
};

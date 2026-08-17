import { ZoomIn, ZoomOut, Play, Pause, Square, MousePointer, Scissors, MoveHorizontal, Sparkles, Loader2, Link2, Unlink2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatUiTime } from "@/lib/utils";
import { useState } from "react";

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
  onGenerateTitle?: () => void;
  isGeneratingTitle?: boolean;
  onApplyJCut?: (duration?: number) => void;
  onApplyLCut?: (duration?: number) => void;
  isAudioLinked?: boolean;
  setIsAudioLinked?: (linked: boolean) => void;
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
  onGenerateTitle,
  isGeneratingTitle = false,
  onApplyJCut,
  onApplyLCut,
  isAudioLinked = true,
  setIsAudioLinked,
}: TimelineControlsProps) => {
  const [jCutDuration, setJCutDuration] = useState<number>(1.0);

  return (
    <div className="flex items-center justify-between px-2 mb-2 gap-3 select-none flex-wrap">
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

        {onGenerateTitle && (
          <Button
            onClick={onGenerateTitle}
            disabled={isGeneratingTitle}
            variant="ghost"
            size="sm"
            className="ml-1.5 h-7 px-2 gap-1.5 text-xs font-medium text-purple-400 hover:text-purple-300 hover:bg-purple-950/40 border border-purple-800/40 rounded-lg transition-all"
            title="Generate AI Title from Transcription (Gemini)"
          >
            {isGeneratingTitle ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            )}
            <span className="hidden sm:inline">AI Title</span>
          </Button>
        )}
      </div>

      {/* Center Tool Group: Edit Tools + J-Cut/L-Cut */}
      <div className="flex items-center gap-2">
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

        {/* J-Cut & L-Cut Quick Actions */}
        {onApplyJCut && (
          <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onApplyJCut(jCutDuration)}
              className="h-7 px-2.5 gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 border border-emerald-800/40 rounded-md transition-all shadow-sm"
              title={`Apply J-Cut at playhead (${jCutDuration}s audio lead)`}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/30" />
              <span>J-Cut ({jCutDuration}s)</span>
            </Button>

            {onApplyLCut && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onApplyLCut(jCutDuration)}
                className="h-7 px-2 text-xs font-medium text-teal-400 hover:text-teal-300 hover:bg-teal-950/40 border border-teal-800/40 rounded-md transition-all"
                title={`Apply L-Cut at playhead (${jCutDuration}s audio lag)`}
              >
                <span>L-Cut</span>
              </Button>
            )}

            {/* Duration Selector */}
            <select
              value={jCutDuration}
              onChange={(e) => setJCutDuration(parseFloat(e.target.value))}
              className="h-7 bg-muted/60 text-muted-foreground text-[11px] font-medium px-1.5 rounded border border-border hover:text-foreground focus:outline-none cursor-pointer"
              title="J-Cut / L-Cut duration"
            >
              <option value={0.5}>0.5s</option>
              <option value={0.8}>0.8s</option>
              <option value={1.0}>1.0s</option>
              <option value={1.5}>1.5s</option>
              <option value={2.0}>2.0s</option>
            </select>

            {/* Link / Unlink Audio & Video */}
            {setIsAudioLinked && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAudioLinked(!isAudioLinked)}
                className={`h-7 px-2 gap-1.5 text-xs font-semibold rounded border transition-all ${
                  isAudioLinked 
                    ? 'text-cyan-300 bg-cyan-950/60 border-cyan-500/50 shadow-sm hover:bg-cyan-900/60 hover:text-cyan-200' 
                    : 'text-neutral-400 bg-neutral-900 border-neutral-700 hover:text-neutral-200'
                }`}
                title={isAudioLinked ? "Audio & Video linked (trims, moves, and deletes together)" : "Audio & Video unlinked (independent edits)"}
              >
                {isAudioLinked ? <Link2 className="w-3.5 h-3.5 text-cyan-400" /> : <Unlink2 className="w-3.5 h-3.5 text-neutral-400" />}
                <span>{isAudioLinked ? "A/V Linked" : "A/V Unlinked"}</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-3 w-40 bg-background px-3 py-1 rounded-lg border border-border">
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


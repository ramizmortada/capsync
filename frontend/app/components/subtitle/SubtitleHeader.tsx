import { useRef, useState, useEffect } from "react";
import { Edit3, Type, Video, Scissors, ChevronLeft, ChevronRight, Clock, Trash2, Download, Upload, Image as ImageIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { parseSRT, parseVTT } from "@/lib/subtitleParser";
import { getAllScreencaps, ScreencapMetadata } from "@/lib/screencapStorage";

interface SubtitleHeaderProps {
  activeTab: 'subtitles' | 'video';
  setActiveTab: (tab: 'subtitles' | 'video') => void;
  silenceThreshold: number;
  setSilenceThreshold: (val: number) => void;
  safePadding: number;
  setSafePadding: (val: number) => void;
  handleAutoCutSilences: () => void;
  selectedIndexesCount: number;
  handleOffsetSegments: (seconds: number) => void;
  onLiftDeleteClick: () => void;
  downloadSRT: () => void;
  onImportSubtitles?: (segments: any[]) => void;
  onExportToImageEditor?: (projectId?: string) => void;
}

export function SubtitleHeader({
  activeTab,
  setActiveTab,
  silenceThreshold,
  setSilenceThreshold,
  safePadding,
  setSafePadding,
  handleAutoCutSilences,
  selectedIndexesCount,
  handleOffsetSegments,
  onLiftDeleteClick,
  downloadSRT,
  onImportSubtitles,
  onExportToImageEditor,
}: SubtitleHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [screencaps, setScreencaps] = useState<ScreencapMetadata[]>([]);
  const [isExportPopoverOpen, setIsExportPopoverOpen] = useState(false);

  useEffect(() => {
    if (isExportPopoverOpen) {
      getAllScreencaps().then(setScreencaps);
    }
  }, [isExportPopoverOpen]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportSubtitles) return;

    const text = await file.text();
    let segments: any[] = [];
    if (file.name.endsWith('.srt')) {
      segments = parseSRT(text);
    } else if (file.name.endsWith('.vtt')) {
      segments = parseVTT(text);
    } else {
      alert("Unsupported file format. Please upload .srt or .vtt.");
      return;
    }
    
    if (segments.length > 0) {
      onImportSubtitles(segments);
    } else {
      alert("Failed to parse subtitles. Please check the file format.");
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-4 border-b border-border bg-card flex justify-between items-center shrink-0">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Edit3 className="w-4 h-4 text-accent-blue" />
        
        <div className="flex items-center gap-0.5 bg-background border border-border rounded-lg p-0.5 ml-2">
          <button
            onClick={() => setActiveTab('subtitles')}
            className={`px-3 py-1 text-xs font-bold rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'subtitles'
                ? 'bg-accent-blue text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Type className="w-3.5 h-3.5" /> Subtitles
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`px-3 py-1 text-xs font-bold rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'video'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Video className="w-3.5 h-3.5" /> Video
          </button>
        </div>
        
        {activeTab === 'subtitles' && (
          <>
            <div className="ml-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 bg-red-950/20 text-red-400 border-red-900/30 hover:bg-red-900/40 hover:text-red-300"
                    title="Auto-Cut Silences Settings"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">Silence Cleaner Settings</span>
                      <Button
                        onClick={handleAutoCutSilences}
                        size="sm"
                        className="h-7 px-3 text-xs bg-red-600 hover:bg-red-500 font-semibold"
                      >
                        Auto-Cut
                      </Button>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-muted-foreground">Min Duration:</span>
                        <span className="font-mono text-accent-blue">{silenceThreshold.toFixed(1)}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="3.0"
                        step="0.1"
                        value={silenceThreshold}
                        onChange={(e) => setSilenceThreshold(parseFloat(e.target.value))}
                        className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent-blue [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-muted-foreground">Safe Area Padding:</span>
                        <span className="font-mono text-accent-blue">{safePadding}ms</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="500"
                        step="10"
                        value={safePadding}
                        onChange={(e) => setSafePadding(parseInt(e.target.value))}
                        className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent-blue [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {selectedIndexesCount === 0 && (
              <div className="flex items-center gap-0.5 ml-3 bg-background border border-border rounded-md overflow-hidden">
                <button 
                  onClick={() => handleOffsetSegments(-0.1)} 
                  className="hover:bg-muted p-1 transition-colors text-muted-foreground hover:text-foreground outline-none focus:outline-none"
                  title="Shift all subtitles 100ms earlier"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <div className="flex items-center gap-1 px-1.5 text-[10px] uppercase font-bold text-muted-foreground/80 select-none">
                  <Clock className="w-3 h-3" /> Offset
                </div>
                <button 
                  onClick={() => handleOffsetSegments(0.1)} 
                  className="hover:bg-muted p-1 transition-colors text-muted-foreground hover:text-foreground outline-none focus:outline-none"
                  title="Shift all subtitles 100ms later"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input 
          type="file" 
          accept=".srt,.vtt" 
          ref={fileInputRef} 
          onChange={handleImportFile} 
          className="hidden" 
        />
        {onImportSubtitles && (
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            size="icon" 
            variant="outline" 
            className="h-8 w-8 shadow-sm text-xs" 
            title="Import Subtitles (.srt, .vtt)"
          >
            <Upload className="w-3.5 h-3.5" />
          </Button>
        )}
        {onExportToImageEditor && activeTab === 'subtitles' && selectedIndexesCount > 0 && (
          <Popover open={isExportPopoverOpen} onOpenChange={setIsExportPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                className="h-8 w-8 bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md"
                title={`Export ${selectedIndexesCount} subtitle(s) to Screencaps`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3 bg-neutral-900 border-neutral-800 flex flex-col gap-3">
              <h4 className="font-semibold text-sm text-neutral-200">Send to Screencap</h4>
              <p className="text-xs text-neutral-400">Add selected captions to a new or existing project.</p>
              
              <Button 
                onClick={() => { setIsExportPopoverOpen(false); onExportToImageEditor(); }} 
                className="w-full justify-start text-xs h-8 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-2" /> New Project
              </Button>
              
              {screencaps.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1 border-t border-neutral-800 pt-3">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Existing Projects</span>
                  <div className="max-h-32 overflow-y-auto pr-1 flex flex-col gap-1 scrollbar-thin">
                    {screencaps.map(proj => (
                      <Button
                        key={proj.id}
                        variant="ghost"
                        onClick={() => { setIsExportPopoverOpen(false); onExportToImageEditor(proj.id); }}
                        className="w-full justify-start text-xs h-8 text-neutral-300 hover:text-white hover:bg-purple-900/40"
                      >
                        <ImageIcon className="w-3 h-3 mr-2 text-purple-400" />
                        <span className="truncate">{proj.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
        {activeTab === 'subtitles' && selectedIndexesCount > 0 && (
          <div className="flex items-center bg-red-950/40 border border-red-800/60 rounded-lg overflow-hidden h-8 shadow-sm">
            <span className="px-2.5 text-xs font-bold text-red-300 border-r border-red-800/60 select-none">
              {selectedIndexesCount}
            </span>
            <button
              onClick={onLiftDeleteClick}
              className="px-2.5 h-full flex items-center justify-center text-red-400 hover:bg-red-600 hover:text-white transition-colors"
              title={`Delete ${selectedIndexesCount} selected subtitle${selectedIndexesCount > 1 ? 's' : ''}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <Button onClick={downloadSRT} size="icon" variant="secondary" className="h-8 w-8 shadow-lg" title="Download .SRT">
          <Download className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

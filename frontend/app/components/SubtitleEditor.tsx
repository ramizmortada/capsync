import { useState, useEffect, useRef } from "react";
import { Edit3, Trash2, Download, Combine, Scissors, ChevronLeft, ChevronRight, Clock, Type, Video, Check, ArrowRight, SquareSplitHorizontal, VolumeX, Settings, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatUiTime } from "@/lib/utils";

function AutoResizeTextarea({ value, onChange, className, ...props }: any) {
  return (
    <div className="grid">
      <textarea
        value={value}
        onChange={onChange}
        className={`${className} col-start-1 row-start-1 resize-none overflow-hidden h-full`}
        rows={1}
        {...props}
      />
      {/* Invisible clone to force the height of the grid */}
      <div 
        className={`${className} col-start-1 row-start-1 invisible whitespace-pre-wrap break-words pointer-events-none`}
        aria-hidden="true"
      >
        {value + " "}
      </div>
    </div>
  );
}

interface SubtitleEditorProps {
  editableSegments: any[];
  selectedIndexes: (number | string)[];
  setSelectedIndexes: React.Dispatch<React.SetStateAction<(number | string)[]>>;
  rippleDeletes: {start: number, end: number}[];
  handleLiftDelete: (indices: (number | string)[]) => void;
  handleRippleDelete: (indices: (number | string)[]) => void;
  silenceThreshold: number;
  setSilenceThreshold: (val: number) => void;
  safePadding: number;
  setSafePadding: (val: number) => void;
  handleAutoCutSilences: () => void;
  currentTime: number;
  handleSegmentChange: (index: number, newText: string) => void;
  handleToggleSegmentSilence: (segmentIndex: number) => void;
  handleMergeSegments: (index1: number, index2: number) => void;
  handleDeleteSegments: (indices: number[]) => void;
  handleDuplicateSegment: (index: number) => void;
  handleOffsetSegments: (seconds: number) => void;
  onSeek: (time: number) => void;
  clearProject: () => void;
  downloadSRT: () => void;
  videoCanvas?: any;
  setVideoCanvas?: any;
  videoSegments?: any[];
  setVideoSegments?: any;
  selectedVideoIndexes?: string[];
}

export function SubtitleEditor({
  editableSegments,
  selectedIndexes,
  setSelectedIndexes,
  rippleDeletes,
  handleLiftDelete,
  handleRippleDelete,
  silenceThreshold,
  setSilenceThreshold,
  safePadding,
  setSafePadding,
  handleAutoCutSilences,
  currentTime,
  handleSegmentChange,
  handleToggleSegmentSilence,
  handleMergeSegments,
  handleDeleteSegments,
  handleDuplicateSegment,
  handleOffsetSegments,
  onSeek,
  clearProject,
  downloadSRT,
  videoCanvas,
  setVideoCanvas,
  videoSegments,
  setVideoSegments,
  selectedVideoIndexes,
}: SubtitleEditorProps) {
  const [activeTab, setActiveTab] = useState<'subtitles' | 'video'>('subtitles');
  const lastSelectedRef = useRef<number | null>(null);

  // Toggle selection or range selection
  const handleSelection = (e: React.MouseEvent, index: number) => {
    if (e.shiftKey) {
      if (lastSelectedRef.current !== null) {
        const start = Math.min(lastSelectedRef.current, index);
        const end = Math.max(lastSelectedRef.current, index);
        const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        setSelectedIndexes(prev => {
          const newSelection = new Set(prev);
          range.forEach(r => newSelection.add(r));
          return Array.from(newSelection);
        });
      } else {
        setSelectedIndexes([index]);
        lastSelectedRef.current = index;
      }
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedIndexes(prev => 
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
      );
      lastSelectedRef.current = index;
    } else {
      setSelectedIndexes([index]);
      lastSelectedRef.current = index;
    }
  };

  const onMergeClick = () => {
    if (selectedIndexes.length === 2) {
      handleMergeSegments(Number(selectedIndexes[0]), Number(selectedIndexes[1]));
      setSelectedIndexes([]);
    }
  };

  const onLiftDeleteClick = () => {
    handleLiftDelete(selectedIndexes);
    setSelectedIndexes([]);
  };

  const onRippleDeleteClick = () => {
    handleRippleDelete(selectedIndexes);
    setSelectedIndexes([]);
  };

  // Keyboard shortcut for deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      const isLiftDeleteKey = e.key === 'Delete' || e.key === 'Backspace' || e.key.toLowerCase() === 'd';
      const isRippleDeleteKey = e.key.toLowerCase() === 'x';
      
      if ((isLiftDeleteKey || isRippleDeleteKey) && !isInput) {
        if (selectedIndexes.length > 0) {
          // Prevent default browser behavior AND prevent page.tsx handler from also firing
          e.preventDefault();
          e.stopImmediatePropagation();
          
          if (isRippleDeleteKey) {
            onRippleDeleteClick();
          } else {
            onLiftDeleteClick();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [selectedIndexes, handleLiftDelete, handleRippleDelete]);

  // Only show merge button if exactly 2 are selected and they are adjacent
  const isMergeVisible = selectedIndexes.length === 2 && typeof selectedIndexes[0] === 'number' && typeof selectedIndexes[1] === 'number' && Math.abs(Number(selectedIndexes[0]) - Number(selectedIndexes[1])) === 1;

  return (
    <Card className="h-full flex flex-col bg-card border-border shadow-2xl overflow-hidden p-0 gap-0">
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
              {selectedIndexes.length === 0 && (
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
          {activeTab === 'subtitles' && selectedIndexes.length > 0 && (
            <div className="flex items-center bg-red-950/40 border border-red-800/60 rounded-lg overflow-hidden h-8 shadow-sm">
              <span className="px-2.5 text-xs font-bold text-red-300 border-r border-red-800/60 select-none">
                {selectedIndexes.length}
              </span>
              <button
                onClick={onLiftDeleteClick}
                className="px-2.5 h-full flex items-center justify-center text-red-400 hover:bg-red-600 hover:text-white transition-colors"
                title={`Delete ${selectedIndexes.length} selected subtitle${selectedIndexes.length > 1 ? 's' : ''}`}
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
      
      {activeTab === 'subtitles' ? (
        <>
      
      <ScrollArea className="flex-1 h-0 bg-background/50">
        <div className="p-0 relative">
          {editableSegments.map((segment, index) => {
            const isActive = currentTime >= (segment.start - 0.05) && currentTime < (segment.end - 0.05);
            const isSelected = selectedIndexes.includes(index);
            const isFirstSelected = isMergeVisible && Math.min(...(selectedIndexes.filter(i => typeof i === 'number') as number[])) === index;
            const canSplit = segment.text.trim().split(/\s+/).filter(Boolean).length >= 2;
            
            return (
              <div key={index} className="relative group">
                <div 
                  id={`subtitle-segment-${index}`}
                  className={`flex gap-3 px-4 py-3 border-b transition-all duration-200 ${
                    isSelected
                      ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500 border-b-emerald-500/30'
                      : isActive 
                        ? 'bg-accent-blue/10 border-l-2 border-l-accent-blue border-b-accent-blue/20' 
                        : 'bg-card border-border hover:bg-muted/50 border-l-2 border-l-transparent'
                  }`}
                >
                  {/* Left Column: Checkbox */}
                  <div className="pt-1">
                    <button 
                      onClick={(e) => handleSelection(e, index)}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        isSelected 
                          ? 'bg-emerald-500 border-emerald-500 text-neutral-950' 
                          : 'border-input hover:border-accent-foreground text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </button>
                  </div>

                  {/* Right Column: Content */}
                  <div className="flex-1 flex flex-col">
                    {/* Top Row: Timestamps and Delete Action */}
                    <div className="text-xs text-muted-foreground mb-2 flex justify-between items-center font-mono tracking-wider">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground/95">{formatUiTime(segment.start)}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
                        <span className="text-muted-foreground/95">{formatUiTime(segment.end)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Silence/Mute Segment Button */}
                        {segment.words && segment.words.length > 0 && (() => {
                          const realWords = segment.words.filter((w: any) => !w.isGap);
                          const isSilenced = realWords.length > 0 && realWords.every((w: any) => w.deleted);
                          return (
                            <button 
                              onClick={() => handleToggleSegmentSilence(index)}
                              className={`transition-colors p-1 rounded-md ${
                                isSilenced 
                                  ? 'text-red-500 bg-red-500/10 opacity-100' 
                                  : 'text-muted-foreground/60 hover:text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10'
                              }`}
                              title={isSilenced ? "Restore Segment Audio" : "Silence Segment"}
                            >
                              <VolumeX className="w-3.5 h-3.5" />
                            </button>
                          );
                        })()}

                        {/* Individual Split Button */}
                        {canSplit && (
                          <button 
                            onClick={() => handleDuplicateSegment(index)}
                            className="text-muted-foreground/60 hover:text-accent-blue transition-colors opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-accent-blue/10"
                            title="Split Segment in Half"
                          >
                            <SquareSplitHorizontal className="w-3 h-3" />
                          </button>
                        )}
                        
                        {/* Individual Delete Button */}
                        <button 
                          onClick={() => {
                            handleDeleteSegments([index]);
                            setSelectedIndexes([]);
                          }}
                          className="text-muted-foreground/60 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/10"
                          title="Delete Segment"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                      <AutoResizeTextarea
                        value={segment.text}
                        onChange={(e: any) => handleSegmentChange(index, e.target.value)}
                        onFocus={() => onSeek(segment.start)}
                        className="w-full bg-transparent text-sm text-foreground outline-none resize-none font-medium placeholder-muted-foreground/30 overflow-hidden"
                        rows={1}
                      />
                  </div>
                </div>

                {/* Inline Merge Button appearing between the two selected adjacent segments */}
                {isFirstSelected && (
                  <div className="absolute left-0 right-0 bottom-0 flex justify-center z-10 pointer-events-none translate-y-[50%]">
                    <Button 
                      size="sm" 
                      onClick={onMergeClick}
                      className="h-8 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-900/50 rounded-full px-4 pointer-events-auto border-2 border-background"
                    >
                      <Combine className="w-4 h-4" /> Merge Segments
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
        </>
      ) : (
        <ScrollArea className="flex-1 h-0 bg-background/50 p-6">
          <div className="flex flex-col gap-8 max-w-lg mx-auto">
            {/* Canvas Settings */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-500" /> Canvas Settings
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Aspect Ratio</label>
                  <select 
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-purple-500"
                    value={videoCanvas?.type || 'auto'}
                    onChange={(e) => {
                      const type = e.target.value;
                      if (type === '16:9') setVideoCanvas({ ...videoCanvas, type, width: 1920, height: 1080 });
                      else if (type === '9:16') setVideoCanvas({ ...videoCanvas, type, width: 1080, height: 1920 });
                      else if (type === '1:1') setVideoCanvas({ ...videoCanvas, type, width: 1080, height: 1080 });
                      else setVideoCanvas({ ...videoCanvas, type: 'auto' });
                    }}
                  >
                    <option value="auto">Original (Auto)</option>
                    <option value="16:9">YouTube (16:9)</option>
                    <option value="9:16">Shorts / TikTok (9:16)</option>
                    <option value="1:1">Square (1:1)</option>
                  </select>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Background Color</label>
                  <div className="flex gap-2 items-center">
                    <input 
                      type="color" 
                      className="w-8 h-8 rounded border-0 p-0 cursor-pointer bg-transparent"
                      value={videoCanvas?.backgroundColor || '#000000'}
                      onChange={(e) => setVideoCanvas({ ...videoCanvas, backgroundColor: e.target.value })}
                    />
                    <input 
                      type="text" 
                      className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none uppercase font-mono"
                      value={videoCanvas?.backgroundColor || '#000000'}
                      onChange={(e) => setVideoCanvas({ ...videoCanvas, backgroundColor: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Transform Settings */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Video className="w-4 h-4 text-purple-500" /> Selected Clip Transform
                </h3>
                {selectedVideoIndexes && selectedVideoIndexes.length > 0 && (
                  <span className="text-xs font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30 min-w-[22px] text-center inline-block">
                    {selectedVideoIndexes.length}
                  </span>
                )}
              </div>
              
              {(!selectedVideoIndexes || selectedVideoIndexes.length === 0) ? (
                <div className="text-sm text-muted-foreground/60 p-6 text-center border border-dashed border-border rounded-lg bg-card/50">
                  Select one or more video clips in the timeline to edit their transform.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6 bg-card border border-border rounded-lg p-5">
                  <div className="flex flex-col gap-3">
                    <label className="text-xs font-medium text-muted-foreground flex justify-between">
                      <span>Position X</span>
                      <span className="font-mono text-purple-400">
                        {Number(videoSegments?.find(s => s.id === selectedVideoIndexes[0])?.transform?.x || 0).toFixed(1)}%
                      </span>
                    </label>
                    <input 
                      type="range" min="-100" max="100" step="0.1"
                      value={videoSegments?.find(s => s.id === selectedVideoIndexes[0])?.transform?.x || 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setVideoSegments((prev: any[]) => prev.map(s => 
                          selectedVideoIndexes.includes(s.id) 
                            ? { ...s, transform: { ...(s.transform || {y: 0, scale: 1}), x: val } } 
                            : s
                        ));
                      }}
                      className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <label className="text-xs font-medium text-muted-foreground flex justify-between">
                      <span>Position Y</span>
                      <span className="font-mono text-purple-400">
                        {Number(videoSegments?.find(s => s.id === selectedVideoIndexes[0])?.transform?.y || 0).toFixed(1)}%
                      </span>
                    </label>
                    <input 
                      type="range" min="-100" max="100" step="0.1"
                      value={videoSegments?.find(s => s.id === selectedVideoIndexes[0])?.transform?.y || 0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setVideoSegments((prev: any[]) => prev.map(s => 
                          selectedVideoIndexes.includes(s.id) 
                            ? { ...s, transform: { ...(s.transform || {x: 0, scale: 1}), y: val } } 
                            : s
                        ));
                      }}
                      className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-3 col-span-2">
                    <label className="text-xs font-medium text-muted-foreground flex justify-between">
                      <span>Scale</span>
                      <span className="font-mono text-purple-400">
                        {((videoSegments?.find(s => s.id === selectedVideoIndexes[0])?.transform?.scale || 1) * 100).toFixed(0)}%
                      </span>
                    </label>
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="outline" size="icon" className="h-7 w-7 shrink-0"
                        onClick={() => {
                          setVideoSegments((prev: any[]) => prev.map(s => 
                            selectedVideoIndexes.includes(s.id) 
                              ? { ...s, transform: { ...(s.transform || {x: 0, y: 0}), scale: Math.max(0.1, (s.transform?.scale || 1) - 0.05) } } 
                              : s
                          ));
                        }}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <input 
                        type="range" min="0.1" max="3.0" step="0.005"
                        value={videoSegments?.find(s => s.id === selectedVideoIndexes[0])?.transform?.scale || 1}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setVideoSegments((prev: any[]) => prev.map(s => 
                            selectedVideoIndexes.includes(s.id) 
                              ? { ...s, transform: { ...(s.transform || {x: 0, y: 0}), scale: val } } 
                              : s
                          ));
                        }}
                        className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                      />
                      <Button 
                        variant="outline" size="icon" className="h-7 w-7 shrink-0"
                        onClick={() => {
                          setVideoSegments((prev: any[]) => prev.map(s => 
                            selectedVideoIndexes.includes(s.id) 
                              ? { ...s, transform: { ...(s.transform || {x: 0, y: 0}), scale: Math.min(3, (s.transform?.scale || 1) + 0.05) } } 
                              : s
                          ));
                        }}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="col-span-2 flex justify-end">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-7 text-muted-foreground"
                      onClick={() => {
                        setVideoSegments((prev: any[]) => prev.map(s => 
                          selectedVideoIndexes.includes(s.id) 
                            ? { ...s, transform: { x: 0, y: 0, scale: 1 } } 
                            : s
                        ));
                      }}
                    >
                      Reset Transform
                    </Button>
                  </div>

                  {/* Clip Crop Section */}
                  <div className="col-span-2 border-t border-border pt-4 mt-2 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5 text-purple-400" /> Crop Video Edges
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Crop Top */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-muted-foreground flex justify-between">
                          <span>Top Crop</span>
                          <span className="font-mono text-purple-400">
                            {Number(videoSegments?.find(s => s.id === selectedVideoIndexes[0])?.crop?.top || 0).toFixed(1)}%
                          </span>
                        </label>
                        <input 
                          type="range" min="0" max="50" step="0.5"
                          value={videoSegments?.find(s => s.id === selectedVideoIndexes[0])?.crop?.top || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setVideoSegments((prev: any[]) => prev.map(s => 
                              selectedVideoIndexes.includes(s.id) 
                                ? { ...s, crop: { ...(s.crop || { top: 0, bottom: 0, left: 0, right: 0 }), top: val } } 
                                : s
                            ));
                          }}
                          className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                        />
                      </div>

                      {/* Crop Bottom */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-muted-foreground flex justify-between">
                          <span>Bottom Crop</span>
                          <span className="font-mono text-purple-400">
                            {Number(videoSegments?.find(s => s.id === selectedVideoIndexes[0])?.crop?.bottom || 0).toFixed(1)}%
                          </span>
                        </label>
                        <input 
                          type="range" min="0" max="50" step="0.5"
                          value={videoSegments?.find(s => s.id === selectedVideoIndexes[0])?.crop?.bottom || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setVideoSegments((prev: any[]) => prev.map(s => 
                              selectedVideoIndexes.includes(s.id) 
                                ? { ...s, crop: { ...(s.crop || { top: 0, bottom: 0, left: 0, right: 0 }), bottom: val } } 
                                : s
                            ));
                          }}
                          className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                        />
                      </div>

                      {/* Crop Left */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-muted-foreground flex justify-between">
                          <span>Left Crop</span>
                          <span className="font-mono text-purple-400">
                            {Number(videoSegments?.find(s => s.id === selectedVideoIndexes[0])?.crop?.left || 0).toFixed(1)}%
                          </span>
                        </label>
                        <input 
                          type="range" min="0" max="50" step="0.5"
                          value={videoSegments?.find(s => s.id === selectedVideoIndexes[0])?.crop?.left || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setVideoSegments((prev: any[]) => prev.map(s => 
                              selectedVideoIndexes.includes(s.id) 
                                ? { ...s, crop: { ...(s.crop || { top: 0, bottom: 0, left: 0, right: 0 }), left: val } } 
                                : s
                            ));
                          }}
                          className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                        />
                      </div>

                      {/* Crop Right */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-muted-foreground flex justify-between">
                          <span>Right Crop</span>
                          <span className="font-mono text-purple-400">
                            {Number(videoSegments?.find(s => s.id === selectedVideoIndexes[0])?.crop?.right || 0).toFixed(1)}%
                          </span>
                        </label>
                        <input 
                          type="range" min="0" max="50" step="0.5"
                          value={videoSegments?.find(s => s.id === selectedVideoIndexes[0])?.crop?.right || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setVideoSegments((prev: any[]) => prev.map(s => 
                              selectedVideoIndexes.includes(s.id) 
                                ? { ...s, crop: { ...(s.crop || { top: 0, bottom: 0, left: 0, right: 0 }), right: val } } 
                                : s
                            ));
                          }}
                          className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 flex justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-7 text-muted-foreground"
                      onClick={() => {
                        setVideoSegments((prev: any[]) => prev.map(s => 
                          selectedVideoIndexes.includes(s.id) 
                            ? { ...s, crop: { top: 0, bottom: 0, left: 0, right: 0 } } 
                            : s
                        ));
                      }}
                    >
                      Reset Crop
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-7 text-muted-foreground"
                      onClick={() => {
                        setVideoSegments((prev: any[]) => prev.map(s => 
                          selectedVideoIndexes.includes(s.id) 
                            ? { ...s, transform: { x: 0, y: 0, scale: 1 }, crop: { top: 0, bottom: 0, left: 0, right: 0 } } 
                            : s
                        ));
                      }}
                    >
                      Reset All
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}

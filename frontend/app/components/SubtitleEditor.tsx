import { useState, useEffect, useRef } from "react";
import { Edit3, Trash2, Download, Combine, Check, ArrowRight, SquareSplitHorizontal, ChevronLeft, ChevronRight, Clock, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  selectedIndexes: number[];
  setSelectedIndexes: React.Dispatch<React.SetStateAction<number[]>>;
  rippleDeletes: {start: number, end: number}[];
  handleLiftDelete: (indices: number[]) => void;
  handleRippleDelete: (indices: number[]) => void;
  silenceThreshold: number;
  setSilenceThreshold: (val: number) => void;
  safePadding: number;
  setSafePadding: (val: number) => void;
  handleAutoCutSilences: () => void;
  currentTime: number;
  handleSegmentChange: (index: number, newText: string) => void;
  handleToggleWordDelete: (segmentIndex: number, wordIndex: number) => void;
  handleToggleSegmentSilence: (segmentIndex: number) => void;
  handleMergeSegments: (index1: number, index2: number) => void;
  handleDeleteSegments: (indices: number[]) => void;
  handleDuplicateSegment: (index: number) => void;
  handleOffsetSegments: (seconds: number) => void;
  onSeek: (time: number) => void;
  clearProject: () => void;
  downloadSRT: () => void;
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
  handleToggleWordDelete,
  handleToggleSegmentSilence,
  handleMergeSegments,
  handleDeleteSegments,
  handleDuplicateSegment,
  handleOffsetSegments,
  onSeek,
  clearProject,
  downloadSRT
}: SubtitleEditorProps) {
  const [editMode, setEditMode] = useState<'text' | 'cut'>('text');
  const lastSelectedRef = useRef<number | null>(null);

  // Toggle selection or range selection
  const handleSelection = (e: React.MouseEvent, index: number) => {
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
    } else {
      setSelectedIndexes(prev => 
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
      );
      lastSelectedRef.current = index;
    }
  };

  const onMergeClick = () => {
    if (selectedIndexes.length === 2) {
      handleMergeSegments(selectedIndexes[0], selectedIndexes[1]);
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
        // Prevent default browser behavior
        e.preventDefault();
        e.stopPropagation();
        
        if (selectedIndexes.length > 0) {
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
  const isMergeVisible = selectedIndexes.length === 2 && Math.abs(selectedIndexes[0] - selectedIndexes[1]) === 1;

  return (
    <Card className="h-full flex flex-col bg-card border-border shadow-2xl overflow-hidden p-0 gap-0">
      <div className="p-4 border-b border-border bg-card flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Edit3 className="w-4 h-4 text-accent-blue" /> Subtitle Editor
          
          <div className="flex items-center gap-0.5 bg-background border border-border rounded-lg p-0.5 ml-2">
            <button
              onClick={() => setEditMode('text')}
              className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded transition-colors ${
                editMode === 'text'
                  ? 'bg-accent-blue text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Edit Text
            </button>
            <button
              onClick={() => setEditMode('cut')}
              className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded transition-colors ${
                editMode === 'cut'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Cut Video
            </button>
          </div>
          {selectedIndexes.length > 0 && (
            <span className="ml-2 text-xs font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
              {selectedIndexes.length} selected
            </span>
          )}
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
        </div>
        <div className="flex items-center gap-2">
          {selectedIndexes.length > 0 ? (
            <Button onClick={onLiftDeleteClick} variant="destructive" size="sm" className="gap-2 h-8 text-xs px-3 shadow-lg bg-red-600 hover:bg-red-500">
              <Trash2 className="w-3 h-3" /> Delete Selected
            </Button>
          ) : (
            <Button onClick={downloadSRT} size="sm" variant="secondary" className="gap-2 h-8 text-xs px-3 shadow-lg">
              <Download className="w-3 h-3" /> Download .SRT
            </Button>
          )}
        </div>
      </div>
      
      {editMode === 'cut' && (
        <div className="p-3 bg-muted/20 border-b border-border flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-muted-foreground/80 tracking-wider">
            <span>Silence Cleaner Settings</span>
            <Button
              onClick={handleAutoCutSilences}
              size="sm"
              className="h-7 px-3 text-xs bg-red-600 hover:bg-red-500 font-semibold"
            >
              Auto-Cut Silences
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px] font-medium">
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
              <div className="flex justify-between text-[11px] font-medium">
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
        </div>
      )}
      
      <ScrollArea className="flex-1 h-0 bg-background/50">
        <div className="p-0 relative">
          {editableSegments.map((segment, index) => {
            const isActive = currentTime >= (segment.start - 0.05) && currentTime < (segment.end - 0.05);
            const isSelected = selectedIndexes.includes(index);
            const isFirstSelected = isMergeVisible && Math.min(...selectedIndexes) === index;
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

                    {editMode === 'cut' && segment.words && segment.words.length > 0 ? (
                      <div className="flex flex-wrap gap-1 py-1">
                        {segment.words.map((word: any, wordIdx: number) => {
                          if (word.isGap) {
                            return (
                              <button
                                key={wordIdx}
                                onClick={() => handleToggleWordDelete(index, wordIdx)}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  onSeek(word.start);
                                }}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-all border font-semibold ${
                                  word.deleted
                                    ? 'line-through bg-red-950/20 text-red-500/60 border-red-900/30 hover:bg-red-950/30'
                                    : 'bg-emerald-950/10 text-emerald-400 border-emerald-900/30 hover:bg-emerald-950/20'
                                }`}
                                title={word.deleted ? "Double-click to seek • Click to restore silence" : "Double-click to seek • Click to cut silence"}
                              >
                                ⏸️ {word.word.replace('[Pause ', '').replace(']', '')}
                              </button>
                            );
                          }
                          
                          return (
                            <button
                              key={wordIdx}
                              onClick={() => handleToggleWordDelete(index, wordIdx)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                onSeek(word.start);
                              }}
                              className={`inline-block px-1.5 py-0.5 rounded text-xs transition-all border ${
                                word.deleted
                                  ? 'line-through bg-red-950/40 text-red-400 border-red-900/50 hover:bg-red-900/40'
                                  : 'bg-muted/30 text-foreground border-border hover:bg-muted/70 hover:border-muted-foreground/30'
                              }`}
                              title={word.deleted ? "Double-click to seek • Click to restore" : "Double-click to seek • Click to cut"}
                            >
                              {word.word}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <AutoResizeTextarea
                        value={segment.text}
                        onChange={(e: any) => handleSegmentChange(index, e.target.value)}
                        onFocus={() => onSeek(segment.start)}
                        className="w-full bg-transparent text-sm text-foreground outline-none resize-none font-medium placeholder-muted-foreground/30 overflow-hidden"
                        rows={1}
                      />
                    )}
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
    </Card>
  );
}

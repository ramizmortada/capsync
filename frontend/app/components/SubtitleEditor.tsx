import { useState, useEffect, useRef } from "react";
import { Edit3, Trash2, Download, Combine, Check, ArrowRight, SquareSplitHorizontal, ChevronLeft, ChevronRight, Clock } from "lucide-react";
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
  currentTime: number;
  handleSegmentChange: (index: number, newText: string) => void;
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
  currentTime,
  handleSegmentChange,
  handleMergeSegments,
  handleDeleteSegments,
  handleDuplicateSegment,
  handleOffsetSegments,
  onSeek,
  clearProject,
  downloadSRT
}: SubtitleEditorProps) {
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);

  // Toggle selection manually when clicking the checkbox
  const toggleSelection = (index: number) => {
    setSelectedIndexes(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const onMergeClick = () => {
    if (selectedIndexes.length === 2) {
      handleMergeSegments(selectedIndexes[0], selectedIndexes[1]);
      setSelectedIndexes([]);
    }
  };

  const onBulkDeleteClick = () => {
    handleDeleteSegments(selectedIndexes);
    setSelectedIndexes([]);
  };

  // Keyboard shortcut for deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      const isDeleteKey = e.key === 'Delete' || e.key === 'Backspace' || e.key.toLowerCase() === 'd';
      
      if (isDeleteKey && !isInput) {
        // Prevent default browser behavior (like navigating back on Backspace)
        e.preventDefault();
        e.stopPropagation();
        
        if (selectedIndexes.length > 0) {
          onBulkDeleteClick();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [selectedIndexes, handleDeleteSegments]);

  // Only show merge button if exactly 2 are selected and they are adjacent
  const isMergeVisible = selectedIndexes.length === 2 && Math.abs(selectedIndexes[0] - selectedIndexes[1]) === 1;

  return (
    <Card className="h-full flex flex-col bg-card border-border shadow-2xl overflow-hidden p-0 gap-0">
      <div className="p-4 border-b border-border bg-card flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Edit3 className="w-4 h-4 text-accent-blue" /> Subtitle Editor
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
            <Button onClick={onBulkDeleteClick} variant="destructive" size="sm" className="gap-2 h-8 text-xs px-3 shadow-lg bg-red-600 hover:bg-red-500">
              <Trash2 className="w-3 h-3" /> Delete Selected
            </Button>
          ) : (
            <Button onClick={downloadSRT} size="sm" variant="secondary" className="gap-2 h-8 text-xs px-3 shadow-lg">
              <Download className="w-3 h-3" /> Download .SRT
            </Button>
          )}
        </div>
      </div>
      
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
                      onClick={() => toggleSelection(index)}
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
    </Card>
  );
}

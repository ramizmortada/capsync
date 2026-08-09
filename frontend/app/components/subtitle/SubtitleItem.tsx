import { Check, ArrowRight, VolumeX, SquareSplitHorizontal, Trash2, Combine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutoResizeTextarea } from "./AutoResizeTextarea";
import { ContextMenuData } from "../timeline/TimelineContextMenu";
import { formatUiTime } from "@/lib/utils";

interface SubtitleItemProps {
  segment: any;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  isFirstSelected: boolean;
  toTimelineTime: (mediaTime: number) => number;
  handleSelection: (e: React.MouseEvent, index: number) => void;
  setContextMenu: (data: ContextMenuData | null) => void;
  handleToggleSegmentSilence: (segmentIndex: number) => void;
  handleDuplicateSegment: (index: number) => void;
  handleDeleteSegments: (indices: number[]) => void;
  setSelectedIndexes: React.Dispatch<React.SetStateAction<(number | string)[]>>;
  handleSegmentChange: (index: number, newText: string) => void;
  onMergeClick: () => void;
}

export function SubtitleItem({
  segment,
  index,
  isActive,
  isSelected,
  isFirstSelected,
  toTimelineTime,
  handleSelection,
  setContextMenu,
  handleToggleSegmentSilence,
  handleDuplicateSegment,
  handleDeleteSegments,
  setSelectedIndexes,
  handleSegmentChange,
  onMergeClick,
}: SubtitleItemProps) {
  const canSplit = segment.text.trim().split(/\s+/).filter(Boolean).length >= 2;

  return (
    <div className="relative group">
      <div 
        id={`subtitle-segment-${index}`}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleSelection(e, index);
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            type: 'Subtitle Segment',
            segmentIdx: index,
          });
        }}
        className={`flex gap-3 px-4 py-3 border-b transition-all duration-200 cursor-context-menu ${
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
              <span className="text-muted-foreground/95">{formatUiTime(toTimelineTime(segment.start))}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-muted-foreground/95">{formatUiTime(toTimelineTime(segment.end))}</span>
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
}

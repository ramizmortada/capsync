import { useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SubtitleItem } from "./SubtitleItem";
import { ContextMenuData } from "../timeline/TimelineContextMenu";
import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { parseSRT, parseVTT } from "@/lib/subtitleParser";

interface SubtitleListProps {
  editableSegments: any[];
  displayActiveIndex: number;
  selectedIndexes: (number | string)[];
  isMergeVisible: boolean;
  toTimelineTime: (mediaTime: number) => number;
  handleSelection: (e: React.MouseEvent, index: number) => void;
  setContextMenu: (data: ContextMenuData | null) => void;
  handleToggleSegmentSilence: (segmentIndex: number) => void;
  handleDuplicateSegment: (index: number) => void;
  handleDeleteSegments: (indices: number[]) => void;
  setSelectedIndexes: React.Dispatch<React.SetStateAction<(number | string)[]>>;
  handleSegmentChange: (index: number, newText: string) => void;
  onMergeClick: () => void;
  onImportSubtitles?: (segments: any[]) => void;
}

export function SubtitleList({
  editableSegments,
  displayActiveIndex,
  selectedIndexes,
  isMergeVisible,
  toTimelineTime,
  handleSelection,
  setContextMenu,
  handleToggleSegmentSilence,
  handleDuplicateSegment,
  handleDeleteSegments,
  setSelectedIndexes,
  handleSegmentChange,
  onMergeClick,
  onImportSubtitles,
}: SubtitleListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firstSelectedIndex = isMergeVisible 
    ? Math.min(...(selectedIndexes.filter(i => typeof i === 'number') as number[])) 
    : -1;

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
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!editableSegments || editableSegments.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background/50 text-muted-foreground p-8">
        <input 
          type="file" 
          accept=".srt,.vtt" 
          ref={fileInputRef} 
          onChange={handleImportFile} 
          className="hidden" 
        />
        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4 border border-border">
          <FileText className="w-8 h-8 text-muted-foreground/60" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No Subtitles Yet</h3>
        <p className="text-sm text-center mb-6 max-w-xs">
          Transcribe your video or import an existing subtitle file to get started.
        </p>
        <Button 
          onClick={() => fileInputRef.current?.click()} 
          className="bg-accent-blue hover:bg-accent-blue/90 text-white shadow-md font-semibold px-6"
        >
          <Upload className="w-4 h-4 mr-2" />
          Import Subtitles (.srt, .vtt)
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 h-0 bg-background/50">
      <div className="p-0 relative">
        {editableSegments.map((segment, index) => {
          const isActive = index === displayActiveIndex;
          const isSelected = selectedIndexes.includes(index);
          const isFirstSelected = isMergeVisible && firstSelectedIndex === index;

          return (
            <SubtitleItem
              key={index}
              segment={segment}
              index={index}
              isActive={isActive}
              isSelected={isSelected}
              isFirstSelected={isFirstSelected}
              toTimelineTime={toTimelineTime}
              handleSelection={handleSelection}
              setContextMenu={setContextMenu}
              handleToggleSegmentSilence={handleToggleSegmentSilence}
              handleDuplicateSegment={handleDuplicateSegment}
              handleDeleteSegments={handleDeleteSegments}
              setSelectedIndexes={setSelectedIndexes}
              handleSegmentChange={handleSegmentChange}
              onMergeClick={onMergeClick}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}

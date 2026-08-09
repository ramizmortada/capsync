import { ScrollArea } from "@/components/ui/scroll-area";
import { SubtitleItem } from "./SubtitleItem";
import { ContextMenuData } from "../timeline/TimelineContextMenu";

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
}: SubtitleListProps) {
  const firstSelectedIndex = isMergeVisible 
    ? Math.min(...(selectedIndexes.filter(i => typeof i === 'number') as number[])) 
    : -1;

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

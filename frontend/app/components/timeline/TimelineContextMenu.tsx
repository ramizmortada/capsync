export interface ContextMenuData {
  x: number;
  y: number;
  segmentIdx?: number;
  wordIdx?: number;
  videoSegmentId?: string;
  isDeleted?: boolean;
  type: 'Empty Space' | 'Silence' | 'Word' | 'Subtitle Segment' | 'Video Segment' | 'Subtitle Track' | 'Video Track';
  gapStart?: number;
  gapEnd?: number;
  insertTime?: number;
}

interface TimelineContextMenuProps {
  contextMenu: ContextMenuData;
  setContextMenu: (val: ContextMenuData | null) => void;
  handleToggleWordDelete?: (segmentIndex: number, wordIndex: number) => void;
  handleRippleDelete: (indices: (number|string)[]) => void;
  handleRippleDeleteRange?: (start: number, end: number) => void;
  handleVideoRippleDelete?: (ids: string[]) => void;
  handleVideoDelete?: (ids: string[]) => void;
  handleLiftDelete?: (indices: (number|string)[]) => void;
  handleClearTrack?: (trackType: 'subtitle' | 'video') => void;
  handleInsertSubtitle?: (time: number) => void;
}

export const TimelineContextMenu = ({
  contextMenu,
  setContextMenu,
  handleToggleWordDelete,
  handleRippleDelete,
  handleRippleDeleteRange,
  handleVideoRippleDelete,
  handleVideoDelete,
  handleLiftDelete,
  handleClearTrack,
  handleInsertSubtitle,
}: TimelineContextMenuProps) => {
  return (
    <div 
      className="fixed bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-lg shadow-xl py-1 z-[9999] text-xs min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
      style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
      onPointerDown={(e) => e.stopPropagation()} // Prevent auto-dismiss when clicking items
    >
      <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider border-b border-neutral-800 mb-1">
        {contextMenu.type} Actions
      </div>
      
      {contextMenu.type === 'Subtitle Track' || contextMenu.type === 'Video Track' ? (
        <button 
          onClick={() => {
            if (handleClearTrack) {
              handleClearTrack(contextMenu.type === 'Subtitle Track' ? 'subtitle' : 'video');
            }
            setContextMenu(null);
          }}
          className="w-full px-3 py-2 text-left hover:bg-neutral-800 transition-colors flex items-center gap-2 text-red-400 hover:text-red-300 font-semibold"
        >
          ❌ Clear Entire Track
        </button>
      ) : (
        <>
          {/* Lift Delete Action */}
          {contextMenu.type === 'Subtitle Segment' && contextMenu.segmentIdx !== undefined && handleLiftDelete && (
            <button 
              onClick={() => {
                handleLiftDelete([contextMenu.segmentIdx!]);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left hover:bg-neutral-800 transition-colors flex items-center gap-2 text-neutral-300 hover:text-white font-medium"
            >
              ❌ Delete (Lift)
            </button>
          )}

          {contextMenu.type === 'Video Segment' && contextMenu.videoSegmentId !== undefined && handleVideoDelete && (
            <button 
              onClick={() => {
                handleVideoDelete([contextMenu.videoSegmentId!]);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left hover:bg-neutral-800 transition-colors flex items-center gap-2 text-neutral-300 hover:text-white font-medium"
            >
              ❌ Delete (Lift)
            </button>
          )}

          {(contextMenu.type === 'Word' || contextMenu.type === 'Silence') && contextMenu.segmentIdx !== undefined && contextMenu.wordIdx !== undefined && handleToggleWordDelete && (
            <button 
              onClick={() => {
                handleToggleWordDelete(contextMenu.segmentIdx!, contextMenu.wordIdx!);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left hover:bg-neutral-800 transition-colors flex items-center gap-2 text-neutral-300 hover:text-white font-medium"
            >
              ❌ {contextMenu.isDeleted ? "Restore" : "Delete (Lift)"}
            </button>
          )}
          
          {/* Insert Subtitle Action */}
          {contextMenu.type === 'Empty Space' && contextMenu.insertTime !== undefined && handleInsertSubtitle && (
            <button 
              onClick={() => {
                handleInsertSubtitle(contextMenu.insertTime!);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left hover:bg-neutral-800 transition-colors flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              ➕ Insert Subtitle Segment
            </button>
          )}

          {/* Ripple Delete Action */}
          <button 
            onClick={() => {
              if (contextMenu.type === 'Empty Space' && handleRippleDeleteRange && contextMenu.gapStart !== undefined && contextMenu.gapEnd !== undefined) {
                handleRippleDeleteRange(contextMenu.gapStart, contextMenu.gapEnd);
              } else if (contextMenu.type === 'Subtitle Segment' && contextMenu.segmentIdx !== undefined) {
                handleRippleDelete([contextMenu.segmentIdx]);
              } else if (contextMenu.type === 'Video Segment' && contextMenu.videoSegmentId !== undefined && handleVideoRippleDelete) {
                handleVideoRippleDelete([contextMenu.videoSegmentId]);
              } else if (contextMenu.segmentIdx !== undefined && contextMenu.wordIdx !== undefined) {
                const key = contextMenu.type === 'Silence' 
                  ? `gap:${contextMenu.segmentIdx}:${contextMenu.wordIdx}` 
                  : `word:${contextMenu.segmentIdx}:${contextMenu.wordIdx}`;
                handleRippleDelete([key]);
              }
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-neutral-800 transition-colors flex items-center gap-2 text-red-400 hover:text-red-300 font-semibold border-t border-neutral-800/50"
          >
            🗑️ Ripple Delete {contextMenu.type === 'Empty Space' ? 'Gap' : ''}
          </button>
        </>
      )}
    </div>
  );
};

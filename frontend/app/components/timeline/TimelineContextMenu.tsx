interface ContextMenuData {
  x: number;
  y: number;
  segmentIdx: number;
  wordIdx: number;
  isDeleted: boolean;
  type: 'Silence' | 'Word';
}

interface TimelineContextMenuProps {
  contextMenu: ContextMenuData;
  setContextMenu: (val: ContextMenuData | null) => void;
  handleToggleWordDelete: (segmentIndex: number, wordIndex: number) => void;
  handleRippleDelete: (indices: (number|string)[]) => void;
}

export const TimelineContextMenu = ({
  contextMenu,
  setContextMenu,
  handleToggleWordDelete,
  handleRippleDelete,
}: TimelineContextMenuProps) => {
  return (
    <div 
      className="fixed bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-lg shadow-xl py-1 z-[9999] text-xs min-w-[150px] animate-in fade-in zoom-in-95 duration-100"
      style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
      onPointerDown={(e) => e.stopPropagation()} // Prevent auto-dismiss when clicking items
    >
      <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider border-b border-neutral-800 mb-1">
        {contextMenu.type} Actions
      </div>
      <button 
        onClick={() => {
          handleToggleWordDelete(contextMenu.segmentIdx, contextMenu.wordIdx);
          setContextMenu(null);
        }}
        className="w-full px-3 py-2 text-left hover:bg-neutral-800 transition-colors flex items-center gap-2 text-red-400 hover:text-red-300 font-semibold"
      >
        ❌ {contextMenu.isDeleted ? "Restore" : "Delete (Lift)"}
      </button>
      <button 
        onClick={() => {
          const key = contextMenu.type === 'Silence' 
            ? `gap:${contextMenu.segmentIdx}:${contextMenu.wordIdx}` 
            : `word:${contextMenu.segmentIdx}:${contextMenu.wordIdx}`;
          handleRippleDelete([key]);
          setContextMenu(null);
        }}
        className="w-full px-3 py-2 text-left hover:bg-neutral-800 transition-colors flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-semibold"
      >
        ✂️ Ripple Delete
      </button>
    </div>
  );
};

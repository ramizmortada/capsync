import { useRef, useState, useLayoutEffect } from 'react';

export interface ContextMenuData {
  x: number;
  y: number;
  segmentIdx?: number;
  wordIdx?: number;
  videoSegmentId?: string;
  audioSegmentId?: string;
  isDeleted?: boolean;
  isAudioMuted?: boolean;
  type: 'Empty Space' | 'Silence' | 'Word' | 'Subtitle Segment' | 'Video Segment' | 'Audio Segment' | 'Subtitle Track' | 'Video Track' | 'Audio Track';
  gapStart?: number;
  gapEnd?: number;
  insertTime?: number;
  timelineStart?: number;
  timelineEnd?: number;
}

interface TimelineContextMenuProps {
  contextMenu: ContextMenuData;
  setContextMenu: (val: ContextMenuData | null) => void;
  handleToggleWordDelete?: (segmentIndex: number, wordIndex: number) => void;
  handleRippleDelete: (indices: (number|string)[]) => void;
  handleRippleDeleteRange?: (start: number, end: number) => void;
  handleVideoRippleDelete?: (ids: string[]) => void;
  handleAudioRippleDelete?: (ids: string[]) => void;
  handleToggleAudioMute?: (ids: string[]) => void;
  handleVideoDelete?: (ids: string[]) => void;
  handleAudioDelete?: (ids: string[]) => void;
  handleLiftDelete?: (indices: (number|string)[]) => void;
  handleClearTrack?: (trackType: 'subtitle' | 'video' | 'audio') => void;
  handleInsertSubtitle?: (time: number) => void;
  applyJCut?: (splitTime: number, duration?: number) => void;
  applyLCut?: (splitTime: number, duration?: number) => void;
}

export const TimelineContextMenu = ({
  contextMenu,
  setContextMenu,
  handleToggleWordDelete,
  handleRippleDelete,
  handleRippleDeleteRange,
  handleVideoRippleDelete,
  handleAudioRippleDelete,
  handleToggleAudioMute,
  handleVideoDelete,
  handleAudioDelete,
  handleLiftDelete,
  handleClearTrack,
  handleInsertSubtitle,
  applyJCut,
  applyLCut,
}: TimelineContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: contextMenu.x, y: contextMenu.y });

  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const menuWidth = rect.width || 180;
    const menuHeight = rect.height || 220;
    const pad = 12;

    let nextX = contextMenu.x;
    let nextY = contextMenu.y;

    // Flip or adjust upwards if overflowing bottom of viewport
    if (nextY + menuHeight > window.innerHeight - pad) {
      nextY = Math.max(pad, window.innerHeight - menuHeight - pad);
    }

    // Shift left if overflowing right of viewport
    if (nextX + menuWidth > window.innerWidth - pad) {
      nextX = Math.max(pad, window.innerWidth - menuWidth - pad);
    }

    setCoords({ x: nextX, y: nextY });
  }, [contextMenu.x, contextMenu.y]);

  return (
    <div 
      ref={menuRef}
      className="fixed bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-lg shadow-2xl py-1 z-[9999] text-xs min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
      style={{ top: `${coords.y}px`, left: `${coords.x}px` }}
      onPointerDown={(e) => e.stopPropagation()} // Prevent auto-dismiss when clicking items
    >
      <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider border-b border-neutral-800 mb-1">
        {contextMenu.type} Actions
      </div>
      
      {contextMenu.type === 'Subtitle Track' || contextMenu.type === 'Video Track' || contextMenu.type === 'Audio Track' ? (
        <button 
          onClick={() => {
            if (handleClearTrack) {
              handleClearTrack(contextMenu.type === 'Subtitle Track' ? 'subtitle' : contextMenu.type === 'Video Track' ? 'video' : 'audio');
            }
            setContextMenu(null);
          }}
          className="w-full px-3 py-2 text-left hover:bg-neutral-800 transition-colors flex items-center gap-2 text-red-400 hover:text-red-300 font-semibold"
        >
          ❌ Clear Entire Track
        </button>
      ) : (
        <>
          {/* J-Cut & L-Cut Actions for Video & Audio Segments */}
          {(contextMenu.type === 'Video Segment' || contextMenu.type === 'Audio Segment') && (
            <>
              {applyJCut && contextMenu.timelineStart !== undefined && (
                <button
                  onClick={() => {
                    applyJCut(contextMenu.timelineStart!, 1.0);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-emerald-950/50 transition-colors flex items-center gap-2 text-emerald-300 font-medium"
                >
                  ⚡ Apply J-Cut (1.0s Lead)
                </button>
              )}
              {applyJCut && contextMenu.timelineStart !== undefined && (
                <button
                  onClick={() => {
                    applyJCut(contextMenu.timelineStart!, 0.5);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-emerald-950/50 transition-colors flex items-center gap-2 text-emerald-300 font-medium"
                >
                  ⚡ Apply J-Cut (0.5s Lead)
                </button>
              )}
              {applyLCut && contextMenu.timelineStart !== undefined && (
                <button
                  onClick={() => {
                    applyLCut(contextMenu.timelineStart!, 1.0);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-teal-950/50 transition-colors flex items-center gap-2 text-teal-300 font-medium"
                >
                  🌊 Apply L-Cut (1.0s Lag)
                </button>
              )}
              <div className="my-1 border-t border-neutral-800" />
            </>
          )}

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
              ❌ Delete Video (Lift)
            </button>
          )}

          {contextMenu.type === 'Audio Segment' && contextMenu.audioSegmentId !== undefined && handleToggleAudioMute && (
            <button 
              onClick={() => {
                handleToggleAudioMute([contextMenu.audioSegmentId!]);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left hover:bg-neutral-800 transition-colors flex items-center gap-2 text-amber-300 hover:text-amber-200 font-medium"
            >
              {contextMenu.isAudioMuted ? '🔊 Unmute Audio Clip (M)' : '🔇 Mute Audio Clip (M)'}
            </button>
          )}

          {contextMenu.type === 'Audio Segment' && contextMenu.audioSegmentId !== undefined && handleAudioDelete && (
            <button 
              onClick={() => {
                handleAudioDelete([contextMenu.audioSegmentId!]);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-left hover:bg-neutral-800 transition-colors flex items-center gap-2 text-neutral-300 hover:text-white font-medium"
            >
              ❌ Delete Audio (Lift)
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
              } else if (contextMenu.type === 'Audio Segment' && contextMenu.audioSegmentId !== undefined && handleAudioRippleDelete) {
                handleAudioRippleDelete([contextMenu.audioSegmentId]);
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

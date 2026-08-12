import React from 'react';
import { CanvasComposition } from '../../types/imageEditor';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sparkles, Plus, Download, Trash2, X, CheckSquare, Layers, Archive } from 'lucide-react';

interface BulkActionToolbarProps {
  selectedCount: number;
  canvases: CanvasComposition[];
  onCreateCanvasWithSelected: () => void;
  onAddToCanvas: (canvasId: string) => void;
  onDownloadSelected: () => void;
  onExportZip?: () => void;
  onRemoveSelected: () => void;
  onClearSelection: () => void;
}

export function BulkActionToolbar({
  selectedCount,
  canvases,
  onCreateCanvasWithSelected,
  onAddToCanvas,
  onDownloadSelected,
  onExportZip,
  onRemoveSelected,
  onClearSelection,
}: BulkActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="bg-zinc-900/95 border border-purple-500/50 backdrop-blur-xl shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-3 text-white">
        {/* Count Badge */}
        <div className="flex items-center gap-2 pr-3 border-r border-zinc-700/80">
          <div className="bg-purple-600/30 border border-purple-500/60 text-purple-300 font-bold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{selectedCount} Selected</span>
          </div>
        </div>

        {/* Action 1: Create New Canvas with Selected */}
        <Button
          onClick={onCreateCanvasWithSelected}
          size="sm"
          className="h-9 px-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-md rounded-xl"
        >
          <Sparkles className="w-4 h-4" />
          <span>New Canvas ({selectedCount})</span>
        </Button>

        {/* Action 2: Add to Existing Canvas Dropdown */}
        {canvases.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3.5 border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 rounded-xl"
              >
                <Layers className="w-4 h-4 text-purple-400" />
                <span>Add to Canvas</span>
                <Plus className="w-3.5 h-3.5 ml-0.5 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1.5 bg-zinc-900 border-zinc-800 text-zinc-200 text-xs shadow-xl rounded-xl">
              <div className="text-[10px] font-bold text-zinc-400 px-2 py-1 uppercase tracking-wider">
                Select Destination Canvas
              </div>
              <div className="flex flex-col gap-0.5 mt-1 max-h-48 overflow-y-auto">
                {canvases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onAddToCanvas(c.id)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-950/50 hover:text-purple-300 transition-colors flex items-center justify-between text-xs"
                  >
                    <span className="truncate font-medium">{c.title}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">({c.frameIds.length})</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Action 3: Download Selected Frames */}
        <Button
          onClick={onDownloadSelected}
          variant="outline"
          size="sm"
          className="h-9 px-3.5 border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 rounded-xl"
        >
          <Download className="w-4 h-4" />
          <span>Download PNGs</span>
        </Button>

        {/* Action 4: Export ZIP */}
        {onExportZip && (
          <Button
            onClick={onExportZip}
            variant="outline"
            size="sm"
            className="h-9 px-3.5 border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-purple-300 hover:text-purple-200 text-xs font-semibold flex items-center gap-1.5 rounded-xl"
          >
            <Archive className="w-4 h-4 text-purple-400" />
            <span>Export ZIP</span>
          </Button>
        )}

        {/* Action 5: Remove Selected */}
        <Button
          onClick={onRemoveSelected}
          variant="ghost"
          size="sm"
          className="h-9 px-3 text-zinc-400 hover:text-red-400 hover:bg-red-950/40 text-xs font-semibold flex items-center gap-1.5 rounded-xl"
        >
          <Trash2 className="w-4 h-4" />
          <span>Remove</span>
        </Button>

        <div className="h-4 w-px bg-zinc-800 my-auto" />

        {/* Clear Selection */}
        <Button
          onClick={onClearSelection}
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-400 hover:text-white rounded-lg"
          title="Clear Selection"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

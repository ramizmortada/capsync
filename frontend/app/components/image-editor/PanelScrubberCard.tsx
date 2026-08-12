import React, { useRef, useEffect, useState } from 'react';
import { StagedFrameItem, FrameTransform } from '../../types/imageEditor';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Trash2,
  Plus,
  Clock,
  FileText,
  Download,
  CheckSquare,
  Square,
  ZoomIn,
  Move,
  RotateCcw,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface PanelScrubberCardProps {
  item: StagedFrameItem;
  trayIndex?: number;
  videoSrc: string | null;
  isSelected?: boolean;
  isInActiveCanvas?: boolean;
  activeCanvasTitle?: string;
  onToggleSelect?: (id: string) => void;
  onUpdateItem: (updated: StagedFrameItem) => void;
  onRemoveItem: (id: string) => void;
  onAddToCanvas?: (itemId: string, canvasId?: string) => void;
  canvases?: Array<{ id: string; title: string }>;
  onExportSingleFrame: (item: StagedFrameItem) => void;
}

export function PanelScrubberCard({
  item,
  trayIndex,
  videoSrc,
  isSelected = false,
  isInActiveCanvas = false,
  activeCanvasTitle,
  onToggleSelect,
  onUpdateItem,
  onRemoveItem,
  onAddToCanvas,
  canvases = [],
  onExportSingleFrame,
}: PanelScrubberCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const lastDrawnImageRef = useRef<HTMLCanvasElement | HTMLImageElement | null>(null);
  const [statusText, setStatusText] = useState<string>('');
  const [showTransforms, setShowTransforms] = useState<boolean>(false);

  // Local frame time for 60 FPS zero-lag slider scrubbing
  const [localFrameTime, setLocalFrameTime] = useState<number>(item.frameTime);

  // Keep localFrameTime in sync with item.frameTime when updated externally
  useEffect(() => {
    setLocalFrameTime(item.frameTime);
  }, [item.frameTime]);

  // Debounce sync back to parent state (150ms after user pauses slider)
  useEffect(() => {
    if (localFrameTime === item.frameTime) return;
    const timer = setTimeout(() => {
      onUpdateItem({ ...item, frameTime: localFrameTime });
    }, 150);
    return () => clearTimeout(timer);
  }, [localFrameTime, item.frameTime]);

  const transform: FrameTransform = item.transform || { scale: 1.0, offsetX: 0, offsetY: 0 };

  const handleUpdateTransform = (newTransform: Partial<FrameTransform>) => {
    onUpdateItem({
      ...item,
      transform: {
        ...transform,
        ...newTransform,
      },
    });
  };

  const handleResetTransform = () => {
    onUpdateItem({
      ...item,
      transform: { scale: 1.0, offsetX: 0, offsetY: 0 },
    });
  };

  // Reusable Video Element Setup (Created once per videoSrc, NOT on every slider tick!)
  useEffect(() => {
    if (!videoSrc) {
      vidRef.current = null;
      return;
    }

    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.muted = true;
    vid.preload = 'auto';
    vid.src = videoSrc;
    vidRef.current = vid;

    return () => {
      vid.onloadedmetadata = null;
      vid.onseeked = null;
      vid.onerror = null;
      vid.src = '';
      vidRef.current = null;
    };
  }, [videoSrc]);

  // Render Frame onto Card Canvas when localFrameTime, customText, or transform changes
  useEffect(() => {
    const vid = vidRef.current;
    if (!vid || !videoSrc) {
      if (!videoSrc) setStatusText('No video source loaded');
      return;
    }

    let isCancelled = false;

    const drawFrameToCanvas = () => {
      if (isCancelled) return;
      const mainCvs = canvasRef.current;
      if (!mainCvs) return;

      const w = vid.videoWidth || 640;
      const h = vid.videoHeight || 360;

      // Offscreen buffer
      const offscreenCvs = document.createElement('canvas');
      offscreenCvs.width = w;
      offscreenCvs.height = h;
      const ctx = offscreenCvs.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();

      const scale = transform.scale;
      const panX = transform.offsetX;
      const panY = transform.offsetY;

      const drawW = w * scale;
      const drawH = h * scale;
      const drawX = - (drawW - w) / 2 + (panX / 100) * w;
      const drawY = - (drawH - h) / 2 + (panY / 100) * h;

      ctx.drawImage(vid, drawX, drawY, drawW, drawH);
      ctx.restore();

      lastDrawnImageRef.current = offscreenCvs;

      // Atomic swap (NO flicker)
      mainCvs.width = w;
      mainCvs.height = h;
      const mainCtx = mainCvs.getContext('2d');
      if (mainCtx) {
        mainCtx.drawImage(offscreenCvs, 0, 0);
      }

      setStatusText('');
    };

    let timer = setTimeout(() => {
      if (!isCancelled && !lastDrawnImageRef.current) {
        setStatusText('Seeking frame...');
      }
    }, 1500);

    vid.onseeked = () => {
      clearTimeout(timer);
      drawFrameToCanvas();
    };

    vid.onerror = () => {
      clearTimeout(timer);
      if (!isCancelled && !lastDrawnImageRef.current) {
        setStatusText('Video load error');
      }
    };

    // Fast seek (takes <10ms because vid.src is already loaded!)
    if (vid.readyState >= 1) {
      vid.currentTime = Math.max(0, localFrameTime);
    } else {
      vid.onloadedmetadata = () => {
        vid.currentTime = Math.max(0, localFrameTime);
      };
    }

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [localFrameTime, item.customText, transform.scale, transform.offsetX, transform.offsetY, videoSrc]);

  return (
    <Card
      className={`p-4 border shadow-lg flex flex-col gap-3.5 relative rounded-xl transition-all shrink-0 ${
        isSelected
          ? 'border-purple-500 bg-purple-950/20 shadow-purple-950/40 ring-1 ring-purple-500'
          : isInActiveCanvas
          ? 'border-purple-500/70 bg-purple-950/30 ring-1 ring-purple-500/40 shadow-purple-950/30'
          : 'bg-card border-border hover:border-purple-500/50'
      }`}
    >
      {/* Header Info */}
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-2">
          {onToggleSelect && (
            <button
              onClick={() => onToggleSelect(item.id)}
              className={`p-0.5 rounded transition-colors ${
                isSelected ? 'text-purple-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={isSelected ? 'Deselect frame' : 'Select frame'}
            >
              {isSelected ? <CheckSquare className="w-4 h-4 fill-purple-500/20" /> : <Square className="w-4 h-4" />}
            </button>
          )}

          {trayIndex !== undefined && (
            <span className="font-mono font-extrabold text-xs bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-2 py-0.5 rounded-md shadow-sm">
              #{trayIndex + 1}
            </span>
          )}

          <span
            onClick={() => onToggleSelect && onToggleSelect(item.id)}
            className="font-semibold text-xs text-purple-300 flex items-center gap-1 bg-purple-950/40 border border-purple-800/40 px-2 py-0.5 rounded-md cursor-pointer select-none"
          >
            <Clock className="w-3 h-3 text-purple-400" />
            Seg #{item.segmentIndex + 1} ({item.startTime.toFixed(2)}s - {item.endTime.toFixed(2)}s)
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowTransforms((prev) => !prev)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
              showTransforms || transform.scale !== 1.0 || transform.offsetX !== 0 || transform.offsetY !== 0
                ? 'border-purple-500/60 bg-purple-950/40 text-purple-300'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
            title="Toggle Position & Zoom Controls"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-950/40 rounded-lg"
            onClick={() => onRemoveItem(item.id)}
            title="Remove from Staging"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Frame Preview Canvas Container */}
      <div className="relative w-full aspect-video bg-black/90 rounded-lg overflow-hidden border border-border flex items-center justify-center shadow-inner min-h-[160px]">
        <canvas ref={canvasRef} className="w-full h-full object-contain" />

        {statusText && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center text-xs text-purple-300 font-medium px-3 text-center">
            {statusText}
          </div>
        )}

        <div className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-sm px-2 py-0.5 rounded border border-white/10 text-xs font-mono text-purple-300 font-bold shadow select-none">
          {localFrameTime.toFixed(2)}s
        </div>
      </div>

      {/* Zero-Lag Frame Timestamp Scrubbing Slider */}
      <div className="flex flex-col gap-1.5 bg-background/60 p-2.5 rounded-lg border border-border/60">
        <div className="flex justify-between text-xs font-medium text-muted-foreground">
          <span>Scrub Frame Timestamp</span>
          <span className="font-mono text-xs text-purple-300 font-bold">{localFrameTime.toFixed(2)}s</span>
        </div>
        <Slider
          value={[localFrameTime]}
          min={item.startTime}
          max={item.endTime}
          step={0.02}
          onValueChange={(val) => setLocalFrameTime(val[0])}
          className="py-1 cursor-pointer"
        />
      </div>

      {/* Collapsible Frame Transformation Controls (Zoom Scale, Pan X, Pan Y) */}
      {showTransforms && (
        <div className="flex flex-col gap-2.5 bg-purple-950/20 border border-purple-800/40 p-3 rounded-lg animate-in fade-in duration-150">
          <div className="flex justify-between items-center pb-1 border-b border-purple-900/40">
            <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5" /> Position & Zoom Controls
            </span>
            {(transform.scale !== 1.0 || transform.offsetX !== 0 || transform.offsetY !== 0) && (
              <button
                onClick={handleResetTransform}
                className="text-[10px] text-purple-400 hover:text-purple-200 flex items-center gap-1 font-semibold"
                title="Reset Zoom & Pan"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
          </div>

          {/* Zoom / Scale */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1"><ZoomIn className="w-3 h-3 text-purple-400" /> Zoom Scale</span>
              <span className="font-mono text-purple-300 font-semibold">{transform.scale.toFixed(2)}x</span>
            </div>
            <Slider
              value={[transform.scale]}
              min={1.0}
              max={3.0}
              step={0.05}
              onValueChange={(val) => handleUpdateTransform({ scale: val[0] })}
            />
          </div>

          {/* Pan X (Left / Right) */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
              <span>Pan Horizontal (Left / Right)</span>
              <span className="font-mono text-purple-300 font-semibold">{transform.offsetX > 0 ? `+${transform.offsetX}` : transform.offsetX}%</span>
            </div>
            <Slider
              value={[transform.offsetX]}
              min={-100}
              max={100}
              step={1}
              onValueChange={(val) => handleUpdateTransform({ offsetX: val[0] })}
            />
          </div>

          {/* Pan Y (Up / Down) */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
              <span>Pan Vertical (Up / Down)</span>
              <span className="font-mono text-purple-300 font-semibold">{transform.offsetY > 0 ? `+${transform.offsetY}` : transform.offsetY}%</span>
            </div>
            <Slider
              value={[transform.offsetY]}
              min={-100}
              max={100}
              step={1}
              onValueChange={(val) => handleUpdateTransform({ offsetY: val[0] })}
            />
          </div>
        </div>
      )}

      {/* Caption Text Area (Multi-line, Fully Visible) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase font-bold text-muted-foreground/90 flex items-center gap-1">
          <FileText className="w-3.5 h-3.5 text-purple-400" /> Caption Text
        </label>
        <textarea
          value={item.customText}
          onChange={(e) => onUpdateItem({ ...item, customText: e.target.value })}
          rows={3}
          className="w-full p-2.5 text-xs text-foreground bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 font-sans resize-y leading-relaxed shadow-inner"
          placeholder="Type or edit caption text..."
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          onClick={() => onExportSingleFrame({ ...item, frameTime: localFrameTime })}
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs flex-1 flex items-center justify-center gap-1.5 border-border hover:bg-muted font-semibold"
          title="Export single frame image"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>Export PNG</span>
        </Button>

        {canvases.length > 0 && onAddToCanvas && (
          <Button
            onClick={() => onAddToCanvas(item.id)}
            size="sm"
            className="h-8 px-3 text-xs bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center justify-center gap-1.5 shadow-sm"
            title="Add frame to current Canvas"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add to Canvas</span>
          </Button>
        )}
      </div>
    </Card>
  );
}

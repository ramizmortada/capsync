import React, { useRef, useEffect, useState } from 'react';
import { CanvasComposition, StagedFrameItem } from '../../types/imageEditor';
import { getTemplatesForFrameCount } from './LayoutTemplates';
import { SubtitleStyle } from '../../types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Trash2, MoveUp, MoveDown, Plus, Sparkles } from 'lucide-react';

export function formatCaptionText(text: string, textTransform?: string): string {
  if (!text) return '';
  if (!textTransform || textTransform === 'none') return text;

  if (textTransform === 'uppercase') {
    return text.toUpperCase();
  }

  if (textTransform === 'lowercase') {
    return text.toLowerCase();
  }

  if (textTransform === 'capitalize') {
    return text
      .toLowerCase()
      .replace(/(?:^|\s|-)\S/g, (char) => char.toUpperCase());
  }

  if (textTransform === 'sentence') {
    return text
      .toLowerCase()
      .replace(/(^\s*|[.!?]\s*)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
  }

  return text;
}

export async function renderCanvasToOffscreen(
  canvas: CanvasComposition,
  stagedItems: StagedFrameItem[],
  videoSrc: string,
  subtitleStyle: SubtitleStyle
): Promise<HTMLCanvasElement | null> {
  const assignedFrames = canvas.frameIds
    .map((id) => stagedItems.find((item) => item.id === id))
    .filter(Boolean) as StagedFrameItem[];

  if (assignedFrames.length === 0) return null;

  const availableTemplates = getTemplatesForFrameCount(assignedFrames.length);
  const activeTemplate =
    availableTemplates.find((t) => t.id === canvas.layoutId) || availableTemplates[0];

  let targetWidth = 1200;
  let targetHeight = 1200;

  if (canvas.aspectPreset === '1:1') {
    targetWidth = 1200;
    targetHeight = 1200;
  } else if (canvas.aspectPreset === '9:16') {
    targetWidth = 1080;
    targetHeight = 1920;
  } else if (canvas.aspectPreset === '16:9') {
    targetWidth = 1920;
    targetHeight = 1080;
  } else if (canvas.aspectPreset === '4:5') {
    targetWidth = 1080;
    targetHeight = 1350;
  } else {
    targetWidth = 1200;
    targetHeight = 1200;
  }

  const offscreenCvs = document.createElement('canvas');
  offscreenCvs.width = targetWidth;
  offscreenCvs.height = targetHeight;
  const ctx = offscreenCvs.getContext('2d');
  if (!ctx) return null;

  const W = canvas.borderWidth ?? 12;
  const C = canvas.borderColor || canvas.backgroundColor || '#0f0f15';

  ctx.fillStyle = C;
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Render each frame
  for (let i = 0; i < assignedFrames.length; i++) {
    const frame = assignedFrames[i];
    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.muted = true;

    await new Promise<void>((resolve) => {
      let timer = setTimeout(resolve, 2500);
      vid.onloadedmetadata = () => {
        vid.currentTime = Math.max(0, frame.frameTime);
      };
      vid.onseeked = () => {
        clearTimeout(timer);
        resolve();
      };
      vid.onerror = () => {
        clearTimeout(timer);
        resolve();
      };
      vid.src = videoSrc;
    });

    const boxSpec = activeTemplate.boxes[i] || activeTemplate.boxes[0];
    const availWidth = targetWidth - W;
    const availHeight = targetHeight - W;

    const boxX = W + boxSpec.x * availWidth;
    const boxY = W + boxSpec.y * availHeight;
    const boxW = boxSpec.w * availWidth - W;
    const boxH = boxSpec.h * availHeight - W;

    ctx.save();

    ctx.beginPath();
    if (canvas.borderRadius > 0) {
      ctx.roundRect(boxX, boxY, boxW, boxH, canvas.borderRadius);
    } else {
      ctx.rect(boxX, boxY, boxW, boxH);
    }
    ctx.clip();

    const imgAspect = (vid.videoWidth || 16) / (vid.videoHeight || 9);
    const boxAspect = boxW / boxH;

    let baseW = boxW;
    let baseH = boxH;
    let baseOffsetX = 0;
    let baseOffsetY = 0;

    if (imgAspect > boxAspect) {
      baseW = boxH * imgAspect;
      baseOffsetX = (boxW - baseW) / 2;
    } else {
      baseH = boxW / imgAspect;
      baseOffsetY = (boxH - baseH) / 2;
    }

    const scale = frame.transform?.scale ?? 1.0;
    const panX = frame.transform?.offsetX ?? 0;
    const panY = frame.transform?.offsetY ?? 0;

    const drawW = baseW * scale;
    const drawH = baseH * scale;

    const drawX = boxX + baseOffsetX - (drawW - baseW) / 2 + (panX / 100) * boxW;
    const drawY = boxY + baseOffsetY - (drawH - baseH) / 2 + (panY / 100) * boxH;

    ctx.drawImage(vid, drawX, drawY, drawW, drawH);

    // Subtitle Text Overlay
    const effectiveSubtitleStyle: SubtitleStyle = {
      ...subtitleStyle,
      ...(canvas.subtitleStyle || {}),
    };

    const rawText = frame.customText || frame.defaultText;
    const textToDraw = formatCaptionText(rawText, effectiveSubtitleStyle.textTransform);
    if (textToDraw) {
      const fontSize = Math.round((effectiveSubtitleStyle.fontSize || 40) * (targetWidth / 1200));
      const font = `${effectiveSubtitleStyle.fontWeight || 'bold'} ${fontSize}px "${effectiveSubtitleStyle.fontFamily || 'Inter'}", sans-serif`;
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const maxTextWidth = boxW * ((effectiveSubtitleStyle.maxWidth ?? 85) / 100);
      const words = textToDraw.split(' ');
      const lines: string[] = [];
      let currentLine = words[0] || '';

      for (let wIdx = 1; wIdx < words.length; wIdx++) {
        const word = words[wIdx];
        const testWidth = ctx.measureText(currentLine + ' ' + word).width;
        if (testWidth <= maxTextWidth) {
          currentLine += ' ' + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);

      const lineHeight = fontSize * 1.25;
      const totalHeight = lines.length * lineHeight;
      const centerY = boxY + boxH * ((effectiveSubtitleStyle.positionY ?? 85) / 100);
      const textX = boxX + boxW / 2;
      const startY = centerY - totalHeight / 2 + lineHeight / 2;

      if (effectiveSubtitleStyle.backgroundEnabled) {
        let maxLineWidth = 0;
        lines.forEach((l) => {
          const w = ctx.measureText(l).width;
          if (w > maxLineWidth) maxLineWidth = w;
        });
        const bgWidth = maxLineWidth + fontSize * 0.8;
        const bgHeight = totalHeight + fontSize * 0.3;
        ctx.save();
        ctx.fillStyle = effectiveSubtitleStyle.backgroundColor || '#000000';
        ctx.globalAlpha = (effectiveSubtitleStyle.backgroundOpacity ?? 50) / 100;
        ctx.fillRect(textX - bgWidth / 2, centerY - bgHeight / 2, bgWidth, bgHeight);
        ctx.restore();
      }

      if (effectiveSubtitleStyle.shadowEnabled) {
        ctx.save();
        ctx.shadowColor = effectiveSubtitleStyle.shadowColor || 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = (effectiveSubtitleStyle.shadowBlur || 6) * (fontSize / 40);
        ctx.shadowOffsetY = (effectiveSubtitleStyle.shadowOffsetY || 3) * (fontSize / 40);
      }

      lines.forEach((lineStr, lineIdx) => {
        const lineY = startY + lineIdx * lineHeight;

        if (effectiveSubtitleStyle.strokeEnabled) {
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.miterLimit = 2;
          ctx.strokeStyle = effectiveSubtitleStyle.strokeColor || '#000000';
          ctx.lineWidth = (effectiveSubtitleStyle.strokeWidth || 3) * (fontSize / 40);
          ctx.strokeText(lineStr, textX, lineY);
        }

        ctx.fillStyle = effectiveSubtitleStyle.textColor || '#ffffff';
        ctx.fillText(lineStr, textX, lineY);
      });

      if (effectiveSubtitleStyle.shadowEnabled) {
        ctx.restore();
      }
    }

    ctx.restore();
  }

  return offscreenCvs;
}

interface CanvasCompositorProps {
  canvas: CanvasComposition;
  stagedItems: StagedFrameItem[];
  videoSrc: string | null;
  subtitleStyle: SubtitleStyle;
  onUpdateCanvas: (updated: CanvasComposition) => void;
  onDeleteCanvas: (canvasId: string) => void;
  onRemoveFrameFromCanvas: (canvasId: string, frameId: string) => void;
  isActive?: boolean;
  onSelect?: () => void;
}

export function CanvasCompositor({
  canvas,
  stagedItems,
  videoSrc,
  subtitleStyle,
  onUpdateCanvas,
  onDeleteCanvas,
  onRemoveFrameFromCanvas,
  isActive = false,
  onSelect,
}: CanvasCompositorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoDecoderRef = useRef<HTMLVideoElement | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // In-memory cache of extracted raw frame HTMLImageElements keyed by `${videoSrc}_${frameTime}`
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Reusable video decoder element setup
  useEffect(() => {
    if (!videoSrc) {
      videoDecoderRef.current = null;
      return;
    }
    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.muted = true;
    vid.preload = 'auto';
    vid.src = videoSrc;
    videoDecoderRef.current = vid;

    return () => {
      vid.onloadedmetadata = null;
      vid.onseeked = null;
      vid.onerror = null;
      vid.src = '';
      videoDecoderRef.current = null;
    };
  }, [videoSrc]);

  // Map frameIds to StagedFrameItems
  const assignedFrames = canvas.frameIds
    .map((id) => stagedItems.find((item) => item.id === id))
    .filter(Boolean) as StagedFrameItem[];

  const frameCount = assignedFrames.length;

  // Get active layout template
  const availableTemplates = getTemplatesForFrameCount(frameCount);
  const activeTemplate =
    availableTemplates.find((t) => t.id === canvas.layoutId) || availableTemplates[0];

  // Fast frame image extraction with zero allocation overhead
  const getFrameImage = async (src: string, frameTime: number): Promise<HTMLImageElement | null> => {
    const cacheKey = `${src}_${frameTime.toFixed(2)}`;
    if (imageCacheRef.current.has(cacheKey)) {
      return imageCacheRef.current.get(cacheKey)!;
    }

    return new Promise((resolve) => {
      let vid = videoDecoderRef.current;
      if (!vid) {
        vid = document.createElement('video');
        vid.crossOrigin = 'anonymous';
        vid.muted = true;
        vid.preload = 'auto';
        vid.src = src;
      }

      let timer = setTimeout(() => {
        if (vid) {
          vid.onseeked = null;
          vid.onerror = null;
        }
        resolve(null);
      }, 3000);

      const seekFrame = () => {
        vid!.onseeked = () => {
          clearTimeout(timer);
          try {
            const cvs = document.createElement('canvas');
            cvs.width = vid!.videoWidth || 1280;
            cvs.height = vid!.videoHeight || 720;
            const ctx = cvs.getContext('2d');
            if (ctx) {
              ctx.drawImage(vid!, 0, 0, cvs.width, cvs.height);
              const img = new Image();
              img.onload = () => {
                imageCacheRef.current.set(cacheKey, img);
                resolve(img);
              };
              img.onerror = () => resolve(null);
              img.src = cvs.toDataURL('image/jpeg', 0.85);
              return;
            }
          } catch (err) {
            console.error('Error caching frame image:', err);
          }
          resolve(null);
        };

        vid!.currentTime = Math.max(0, frameTime);
      };

      if (vid.readyState >= 1) {
        seekFrame();
      } else {
        vid.onloadedmetadata = () => seekFrame();
      }

      vid.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
    });
  };

  // Draw composition onto canvas with Unified Grid Border & Gap Math
  useEffect(() => {
    if (!videoSrc || !canvasRef.current || frameCount === 0) return;

    let isCancelled = false;

    const renderComposition = async () => {
      const mainCvs = canvasRef.current;
      if (!mainCvs) return;

      const vidDecoder = videoDecoderRef.current;
      const videoWidth = vidDecoder?.videoWidth || 1920;
      const videoHeight = vidDecoder?.videoHeight || 1080;

      let targetWidth = 1200;
      let targetHeight = 1200;

      if (canvas.aspectPreset === '1:1') {
        targetWidth = 1200;
        targetHeight = 1200;
      } else if (canvas.aspectPreset === '9:16') {
        targetWidth = 1080;
        targetHeight = 1920;
      } else if (canvas.aspectPreset === '16:9') {
        targetWidth = 1920;
        targetHeight = 1080;
      } else if (canvas.aspectPreset === '4:5') {
        targetWidth = 1080;
        targetHeight = 1350;
      } else {
        const aspect = activeTemplate.boxes.length > 0
          ? (videoWidth / videoHeight) * (activeTemplate.boxes[0].w / activeTemplate.boxes[0].h)
          : (videoWidth / videoHeight);
        targetWidth = 1200;
        targetHeight = Math.round(1200 / aspect);
      }

      // Create OFFSCREEN canvas for Double-Buffering (no flicker!)
      const offscreenCvs = document.createElement('canvas');
      offscreenCvs.width = targetWidth;
      offscreenCvs.height = targetHeight;
      const ctx = offscreenCvs.getContext('2d');
      if (!ctx) return;

      // Unified Border Width W & Color C
      const W = canvas.borderWidth ?? 12;
      const C = canvas.borderColor || canvas.backgroundColor || '#0f0f15';

      // 1. Fill entire canvas background with color C
      ctx.fillStyle = C;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // 2. Fetch or use cached frame images for all panels
      const frameImages: Array<HTMLImageElement | null> = [];
      for (let i = 0; i < assignedFrames.length; i++) {
        if (isCancelled) return;
        const frame = assignedFrames[i];
        const img = await getFrameImage(videoSrc, frame.frameTime);
        frameImages.push(img);
      }

      if (isCancelled) return;

      const availWidth = targetWidth - W;
      const availHeight = targetHeight - W;

      // Merge per-canvas subtitle style with global subtitle style
      const effectiveSubtitleStyle: SubtitleStyle = {
        ...subtitleStyle,
        ...(canvas.subtitleStyle || {}),
      };

      // Render each panel frame box
      for (let i = 0; i < assignedFrames.length; i++) {
        const frame = assignedFrames[i];
        const frameImg = frameImages[i];
        const boxSpec = activeTemplate.boxes[i] || activeTemplate.boxes[0];

        const boxX = W + boxSpec.x * availWidth;
        const boxY = W + boxSpec.y * availHeight;
        const boxW = boxSpec.w * availWidth - W;
        const boxH = boxSpec.h * availHeight - W;

        ctx.save();

        // Always clip panel box bounds so frame images & transforms never overflow outside box
        ctx.beginPath();
        if (canvas.borderRadius > 0) {
          ctx.roundRect(boxX, boxY, boxW, boxH, canvas.borderRadius);
        } else {
          ctx.rect(boxX, boxY, boxW, boxH);
        }
        ctx.clip();

        if (frameImg) {
          const imgAspect = frameImg.width / frameImg.height;
          const boxAspect = boxW / boxH;

          let baseW = boxW;
          let baseH = boxH;
          let baseOffsetX = 0;
          let baseOffsetY = 0;

          if (imgAspect > boxAspect) {
            baseW = boxH * imgAspect;
            baseOffsetX = (boxW - baseW) / 2;
          } else {
            baseH = boxW / imgAspect;
            baseOffsetY = (boxH - baseH) / 2;
          }

          const scale = frame.transform?.scale ?? 1.0;
          const panX = frame.transform?.offsetX ?? 0;
          const panY = frame.transform?.offsetY ?? 0;

          const drawW = baseW * scale;
          const drawH = baseH * scale;

          const drawX = boxX + baseOffsetX - (drawW - baseW) / 2 + (panX / 100) * boxW;
          const drawY = boxY + baseOffsetY - (drawH - baseH) / 2 + (panY / 100) * boxH;

          ctx.drawImage(frameImg, drawX, drawY, drawW, drawH);
        } else {
          ctx.fillStyle = '#1a1a24';
          ctx.fillRect(boxX, boxY, boxW, boxH);
        }

        // Subtitle Text Overlay with Multi-Line Wrapping & Advanced Styling
        const rawText = frame.customText || frame.defaultText;
        const textToDraw = formatCaptionText(rawText, effectiveSubtitleStyle.textTransform);
        if (textToDraw) {
          const fontSize = Math.round((effectiveSubtitleStyle.fontSize || 40) * (targetWidth / 1200));
          const font = `${effectiveSubtitleStyle.fontWeight || 'bold'} ${fontSize}px "${effectiveSubtitleStyle.fontFamily || 'Inter'}", sans-serif`;
          ctx.font = font;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const maxTextWidth = boxW * ((effectiveSubtitleStyle.maxWidth ?? 85) / 100);

          // Multi-line word wrapping
          const words = textToDraw.split(' ');
          const lines: string[] = [];
          let currentLine = words[0] || '';

          for (let wIdx = 1; wIdx < words.length; wIdx++) {
            const word = words[wIdx];
            const testWidth = ctx.measureText(currentLine + ' ' + word).width;
            if (testWidth <= maxTextWidth) {
              currentLine += ' ' + word;
            } else {
              lines.push(currentLine);
              currentLine = word;
            }
          }
          lines.push(currentLine);

          const lineHeight = fontSize * 1.25;
          const totalHeight = lines.length * lineHeight;
          const centerY = boxY + boxH * ((effectiveSubtitleStyle.positionY ?? 85) / 100);
          const textX = boxX + boxW / 2;
          const startY = centerY - totalHeight / 2 + lineHeight / 2;

          // Background Box
          if (effectiveSubtitleStyle.backgroundEnabled) {
            let maxLineWidth = 0;
            lines.forEach((l) => {
              const w = ctx.measureText(l).width;
              if (w > maxLineWidth) maxLineWidth = w;
            });
            const bgWidth = maxLineWidth + fontSize * 0.8;
            const bgHeight = totalHeight + fontSize * 0.3;
            ctx.save();
            ctx.fillStyle = effectiveSubtitleStyle.backgroundColor || '#000000';
            ctx.globalAlpha = (effectiveSubtitleStyle.backgroundOpacity ?? 50) / 100;
            ctx.fillRect(textX - bgWidth / 2, centerY - bgHeight / 2, bgWidth, bgHeight);
            ctx.restore();
          }

          // Text Shadow
          if (effectiveSubtitleStyle.shadowEnabled) {
            ctx.save();
            ctx.shadowColor = effectiveSubtitleStyle.shadowColor || 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = (effectiveSubtitleStyle.shadowBlur || 6) * (fontSize / 40);
            ctx.shadowOffsetY = (effectiveSubtitleStyle.shadowOffsetY || 3) * (fontSize / 40);
          }

          // Draw Stroke & Fill Text for each line
          lines.forEach((lineStr, lineIdx) => {
            const lineY = startY + lineIdx * lineHeight;

            if (effectiveSubtitleStyle.strokeEnabled) {
              ctx.lineJoin = 'round';
              ctx.lineCap = 'round';
              ctx.miterLimit = 2;
              ctx.strokeStyle = effectiveSubtitleStyle.strokeColor || '#000000';
              ctx.lineWidth = (effectiveSubtitleStyle.strokeWidth || 3) * (fontSize / 40);
              ctx.strokeText(lineStr, textX, lineY);
            }

            ctx.fillStyle = effectiveSubtitleStyle.textColor || '#ffffff';
            ctx.fillText(lineStr, textX, lineY);
          });

          if (effectiveSubtitleStyle.shadowEnabled) {
            ctx.restore();
          }
        }

        ctx.restore();
      }

      if (isCancelled) return;

      // Copy completed offscreen canvas to main canvas in ONE atomic swap (ZERO black flicker!)
      mainCvs.width = targetWidth;
      mainCvs.height = targetHeight;
      const mainCtx = mainCvs.getContext('2d');
      if (mainCtx) {
        mainCtx.drawImage(offscreenCvs, 0, 0);
      }
    };

    renderComposition();

    return () => {
      isCancelled = true;
    };
  }, [canvas, assignedFrames, videoSrc, subtitleStyle, activeTemplate]);

  const handleDownloadPNG = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${canvas.title.toLowerCase().replace(/\s+/g, '_')}.png`;
    link.href = dataUrl;
    link.click();
  };

  const moveFrame = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= canvas.frameIds.length) return;
    const newFrameIds = [...canvas.frameIds];
    const temp = newFrameIds[index];
    newFrameIds[index] = newFrameIds[targetIdx];
    newFrameIds[targetIdx] = temp;
    onUpdateCanvas({ ...canvas, frameIds: newFrameIds });
  };

  return (
    <Card
      onClick={onSelect}
      className={`p-4 bg-card shadow-xl flex flex-col gap-3 relative transition-all rounded-xl cursor-pointer ${
        isActive
          ? 'border-2 border-purple-500 ring-2 ring-purple-500/30'
          : 'border border-border opacity-95 hover:border-purple-500/50'
      }`}
    >
      {/* Canvas Header */}
      <div className="flex justify-between items-center border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <input
            type="text"
            value={canvas.title}
            onChange={(e) => onUpdateCanvas({ ...canvas, title: e.target.value })}
            className="font-bold text-sm bg-transparent border-0 text-foreground focus:ring-1 focus:ring-purple-500 rounded px-1"
          />
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {frameCount} frame{frameCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleDownloadPNG}
            disabled={frameCount === 0 || isRendering}
            size="sm"
            className="h-8 px-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PNG</span>
          </Button>

          <Button
            onClick={() => onDeleteCanvas(canvas.id)}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-950/30"
            title="Delete Canvas"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Composition Canvas View */}
      <div className="relative bg-black/80 rounded-lg overflow-hidden border border-border flex items-center justify-center p-2 min-h-[300px]">
        {frameCount === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground py-12 text-xs">
            <Plus className="w-8 h-8 text-purple-400/50" />
            <span>No frames assigned to this canvas yet.</span>
            <span className="text-[11px] text-muted-foreground/70">
              Click "+ Add to Canvas" on items from the Staging Tray.
            </span>
          </div>
        ) : (
          <canvas ref={canvasRef} className="max-w-full max-h-[550px] object-contain shadow-2xl transition-all" />
        )}
      </div>

      {/* Frame Items Control Strip */}
      {frameCount > 0 && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
          <span className="text-[11px] font-bold text-muted-foreground/80 uppercase">Assigned Frames Order</span>
          <div className="flex flex-wrap gap-2">
            {assignedFrames.map((frame, idx) => {
              const trayIdx = stagedItems.findIndex((s) => s.id === frame.id);
              return (
                <div
                  key={frame.id}
                  className="flex items-center gap-1.5 bg-background border border-border px-2 py-1 rounded text-xs"
                >
                  <span className="font-mono bg-purple-950/60 text-purple-300 border border-purple-800/40 px-1.5 py-0.2 rounded font-bold">
                    #{trayIdx !== -1 ? trayIdx + 1 : idx + 1}
                  </span>
                  <span className="text-muted-foreground truncate max-w-[120px]">{frame.customText}</span>

                  <div className="flex items-center gap-0.5 ml-1">
                    <button
                      onClick={() => moveFrame(idx, 'up')}
                      disabled={idx === 0}
                      className="hover:text-purple-300 disabled:opacity-30 p-0.5"
                      title="Move left/up"
                    >
                      <MoveUp className="w-3 h-3 rotate-270" />
                    </button>
                    <button
                      onClick={() => moveFrame(idx, 'down')}
                      disabled={idx === assignedFrames.length - 1}
                      className="hover:text-purple-300 disabled:opacity-30 p-0.5"
                      title="Move right/down"
                    >
                      <MoveDown className="w-3 h-3 rotate-270" />
                    </button>
                    <button
                      onClick={() => onRemoveFrameFromCanvas(canvas.id, frame.id)}
                      className="hover:text-red-400 p-0.5 ml-0.5 text-muted-foreground"
                      title="Remove frame from this canvas"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

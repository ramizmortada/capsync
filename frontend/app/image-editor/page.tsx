'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { StagedFrameItem, CanvasComposition } from '../types/imageEditor';
import { SubtitleStyle, DEFAULT_PRESETS } from '../types';
import { getTimeline, getAllTimelines } from '@/lib/timelineStorage';
import JSZip from 'jszip';
import { PanelScrubberCard } from '../components/image-editor/PanelScrubberCard';
import { CanvasCompositor, formatCaptionText, renderCanvasToOffscreen } from '../components/image-editor/CanvasCompositor';
import { PanelStyleControls } from '../components/image-editor/PanelStyleControls';
import { BulkActionToolbar } from '../components/image-editor/BulkActionToolbar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  Plus,
  ImageIcon,
  Layers,
  Sparkles,
  Grid,
  CheckSquare,
  Square,
  Archive,
} from 'lucide-react';

export default function ImageEditorPage() {
  const router = useRouter();

  // Video Media State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Staging Tray State
  const [stagedItems, setStagedItems] = useState<StagedFrameItem[]>([]);
  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>([]);

  // Canvases State
  const [canvases, setCanvases] = useState<CanvasComposition[]>([]);
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Subtitle Style State
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(
    DEFAULT_PRESETS[0].subtitleStyle
  );

  // 1. Load project video, saved canvases, and staged captions on initial mount
  useEffect(() => {
    async function loadData() {
      let loadedVideoUrl: string | null = null;
      let projectSegments: any[] = [];

      // Load active project timeline video file from IDB
      try {
        const timelines = await getAllTimelines();
        const activeId = timelines.length > 0 ? timelines[0].id : 'main_timeline';
        const project = await getTimeline(activeId);

        if (project && project.file) {
          loadedVideoUrl = URL.createObjectURL(project.file);
          setVideoUrl(loadedVideoUrl);
        }

        if (project && project.editableSegments) {
          projectSegments = project.editableSegments;
        }
      } catch (err) {
        console.error('Failed to load project video from storage', err);
      }

      // Load staged captions from localStorage or fallback to project segments
      const savedStaged = localStorage.getItem('capsync_staged_captions');
      let itemsToStage: StagedFrameItem[] = [];

      if (savedStaged) {
        try {
          itemsToStage = JSON.parse(savedStaged);
        } catch (err) {
          console.error('Failed to parse staged captions', err);
        }
      }

      // Fallback: If no explicitly staged items, populate from active project segments
      if (itemsToStage.length === 0 && projectSegments.length > 0) {
        itemsToStage = projectSegments.map((seg, idx) => ({
          id: `stage_auto_${idx}_${Date.now()}`,
          segmentIndex: idx,
          startTime: seg.start,
          endTime: seg.end,
          frameTime: seg.start + (seg.end - seg.start) / 2,
          defaultText: seg.text || '',
          customText: seg.text || '',
        }));
      }

      setStagedItems(itemsToStage);

      // Load saved canvases from localStorage (NO auto-creation of default canvas!)
      const savedCanvases = localStorage.getItem('capsync_editor_canvases');
      if (savedCanvases) {
        try {
          const parsedCanvases: CanvasComposition[] = JSON.parse(savedCanvases);
          setCanvases(parsedCanvases);

          const savedActiveId = localStorage.getItem('capsync_active_canvas_id');
          if (savedActiveId && parsedCanvases.some((c) => c.id === savedActiveId)) {
            setActiveCanvasId(savedActiveId);
          } else if (parsedCanvases.length > 0) {
            setActiveCanvasId(parsedCanvases[0].id);
          }
        } catch (err) {
          console.error('Failed to parse saved canvases', err);
        }
      }

      // Load saved subtitle style
      const savedStyle = localStorage.getItem('capsync_subtitle_style');
      if (savedStyle) {
        try {
          setSubtitleStyle(JSON.parse(savedStyle));
        } catch (err) {
          console.error('Failed to parse subtitle style', err);
        }
      }

      setIsLoaded(true);
    }

    loadData();
  }, []);

  // 2. Persistent Auto-Save for Canvases
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('capsync_editor_canvases', JSON.stringify(canvases));
  }, [canvases, isLoaded]);

  // 3. Persistent Auto-Save for Staged Items
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('capsync_staged_captions', JSON.stringify(stagedItems));
  }, [stagedItems, isLoaded]);

  // 4. Persistent Auto-Save for Active Canvas ID
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('capsync_active_canvas_id', activeCanvasId || '');
  }, [activeCanvasId, isLoaded]);

  // Handlers for Staged Items
  const handleUpdateItem = (updated: StagedFrameItem) => {
    setStagedItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleRemoveItem = (id: string) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedFrameIds((prev) => prev.filter((fId) => fId !== id));
    setCanvases((prev) =>
      prev.map((c) => ({
        ...c,
        frameIds: c.frameIds.filter((fId) => fId !== id),
      }))
    );
  };

  // Selection Handlers
  const handleToggleSelectFrame = (id: string) => {
    setSelectedFrameIds((prev) =>
      prev.includes(id) ? prev.filter((fId) => fId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedFrameIds.length === stagedItems.length) {
      setSelectedFrameIds([]);
    } else {
      setSelectedFrameIds(stagedItems.map((item) => item.id));
    }
  };

  // Handlers for Canvases
  const handleCreateNewCanvas = () => {
    const newId = `canvas_${Date.now()}`;
    const refCanvas = canvases[0];
    const newCanvas: CanvasComposition = {
      id: newId,
      title: `Panel Composition ${canvases.length + 1}`,
      frameIds: [],
      layoutId: 'single',
      aspectPreset: refCanvas?.aspectPreset || 'auto',
      borderWidth: refCanvas?.borderWidth ?? 12,
      borderColor: refCanvas?.borderColor || '#0f0f15',
      borderRadius: refCanvas?.borderRadius ?? 8,
      gap: refCanvas?.gap ?? 12,
      padding: refCanvas?.padding ?? 0,
      backgroundColor: refCanvas?.backgroundColor || '#0f0f15',
      showBorders: true,
      subtitleStyle: refCanvas?.subtitleStyle || subtitleStyle || {},
    };
    setCanvases((prev) => [...prev, newCanvas]);
    setActiveCanvasId(newId);
  };

  const handleCreateCanvasWithSelected = () => {
    if (selectedFrameIds.length === 0) return;
    const newId = `canvas_${Date.now()}`;
    const count = selectedFrameIds.length;
    const layoutId = count === 1 ? 'single' : count === 2 ? 'stack-2' : count === 3 ? 'stack-3' : 'grid-2x2';
    const refCanvas = canvases[0];

    const newCanvas: CanvasComposition = {
      id: newId,
      title: `Selected Composition (${count})`,
      frameIds: [...selectedFrameIds],
      layoutId,
      aspectPreset: refCanvas?.aspectPreset || 'auto',
      borderWidth: refCanvas?.borderWidth ?? 12,
      borderColor: refCanvas?.borderColor || '#0f0f15',
      borderRadius: refCanvas?.borderRadius ?? 8,
      gap: refCanvas?.gap ?? 12,
      padding: refCanvas?.padding ?? 0,
      backgroundColor: refCanvas?.backgroundColor || '#0f0f15',
      showBorders: true,
      subtitleStyle: refCanvas?.subtitleStyle || subtitleStyle || {},
    };
    setCanvases((prev) => [...prev, newCanvas]);
    setActiveCanvasId(newId);
    setSelectedFrameIds([]);
  };

  const handleAddSelectedToCanvas = (targetCanvasId: string) => {
    if (selectedFrameIds.length === 0) return;

    setCanvases((prev) =>
      prev.map((c) => {
        if (c.id === targetCanvasId) {
          const merged = new Set([...c.frameIds, ...selectedFrameIds]);
          return { ...c, frameIds: Array.from(merged) };
        }
        return c;
      })
    );
    setSelectedFrameIds([]);
  };

  const handleUpdateCanvas = (updated: CanvasComposition) => {
    setCanvases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleDeleteCanvas = (canvasId: string) => {
    setCanvases((prev) => prev.filter((c) => c.id !== canvasId));
    if (activeCanvasId === canvasId) {
      const remaining = canvases.filter((c) => c.id !== canvasId);
      setActiveCanvasId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleAddFrameToCanvas = (frameId: string, targetCanvasId?: string) => {
    const destCanvasId = targetCanvasId || activeCanvasId || canvases[0]?.id;
    if (!destCanvasId) return;

    setCanvases((prev) =>
      prev.map((c) => {
        if (c.id === destCanvasId) {
          if (c.frameIds.includes(frameId)) return c;
          return { ...c, frameIds: [...c.frameIds, frameId] };
        }
        return c;
      })
    );
  };

  const handleRemoveFrameFromCanvas = (canvasId: string, frameId: string) => {
    setCanvases((prev) =>
      prev.map((c) => (c.id === canvasId ? { ...c, frameIds: c.frameIds.filter((f) => f !== frameId) } : c))
    );
  };

  const handleExportSingleFrame = async (item: StagedFrameItem) => {
    if (!videoUrl) return;
    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.muted = true;

    await new Promise<void>((resolve) => {
      let timer = setTimeout(resolve, 2500);
      vid.onloadedmetadata = () => {
        vid.currentTime = Math.max(0, item.frameTime);
      };
      vid.onseeked = () => {
        clearTimeout(timer);
        resolve();
      };
      vid.onerror = () => {
        clearTimeout(timer);
        resolve();
      };
      vid.src = videoUrl;
    });

    const cvs = document.createElement('canvas');
    const w = vid.videoWidth || 1920;
    const h = vid.videoHeight || 1080;
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();

    const scale = item.transform?.scale ?? 1.0;
    const panX = item.transform?.offsetX ?? 0;
    const panY = item.transform?.offsetY ?? 0;

    const drawW = w * scale;
    const drawH = h * scale;
    const drawX = - (drawW - w) / 2 + (panX / 100) * w;
    const drawY = - (drawH - h) / 2 + (panY / 100) * h;

    ctx.drawImage(vid, drawX, drawY, drawW, drawH);
    ctx.restore();

    const rawText = item.customText || item.defaultText;
    const textToDraw = formatCaptionText(rawText, subtitleStyle.textTransform);
    if (textToDraw) {
      const fontSize = Math.round((subtitleStyle.fontSize || 40) * (cvs.width / 1200));
      ctx.font = `${subtitleStyle.fontWeight || 'bold'} ${fontSize}px "${subtitleStyle.fontFamily || 'Inter'}", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textY = cvs.height * ((subtitleStyle.positionY ?? 85) / 100);
      const textX = cvs.width / 2;

      if (subtitleStyle.strokeEnabled) {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.miterLimit = 2;
        ctx.strokeStyle = subtitleStyle.strokeColor || '#000000';
        ctx.lineWidth = (subtitleStyle.strokeWidth || 3) * (fontSize / 40);
        ctx.strokeText(textToDraw, textX, textY);
      }

      ctx.fillStyle = subtitleStyle.textColor || '#ffffff';
      ctx.fillText(textToDraw, textX, textY);
    }

    const dataUrl = cvs.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `caption_frame_${item.segmentIndex + 1}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleDownloadSelectedFrames = () => {
    const items = stagedItems.filter((item) => selectedFrameIds.includes(item.id));
    items.forEach((item) => handleExportSingleFrame(item));
  };

  const handleRemoveSelectedFrames = () => {
    setStagedItems((prev) => prev.filter((item) => !selectedFrameIds.includes(item.id)));
    setCanvases((prev) =>
      prev.map((c) => ({
        ...c,
        frameIds: c.frameIds.filter((fId) => !selectedFrameIds.includes(fId)),
      }))
    );
    setSelectedFrameIds([]);
  };

  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState('');

  const handleExportZipArchive = async () => {
    if (!videoUrl || (stagedItems.length === 0 && canvases.length === 0)) return;
    setIsZipping(true);
    setZipProgress('Preparing ZIP...');

    try {
      const zip = new JSZip();
      const framesFolder = zip.folder('individual_frames');
      const canvasesFolder = zip.folder('canvases');

      // 1. Render all Individual Staged Frames
      for (let i = 0; i < stagedItems.length; i++) {
        const item = stagedItems[i];
        setZipProgress(`Frame ${i + 1}/${stagedItems.length}`);

        const vid = document.createElement('video');
        vid.crossOrigin = 'anonymous';
        vid.muted = true;

        await new Promise<void>((resolve) => {
          let timer = setTimeout(resolve, 2500);
          vid.onloadedmetadata = () => {
            vid.currentTime = Math.max(0, item.frameTime);
          };
          vid.onseeked = () => {
            clearTimeout(timer);
            resolve();
          };
          vid.onerror = () => {
            clearTimeout(timer);
            resolve();
          };
          vid.src = videoUrl;
        });

        const cvs = document.createElement('canvas');
        const w = vid.videoWidth || 1920;
        const h = vid.videoHeight || 1080;
        cvs.width = w;
        cvs.height = h;
        const ctx = cvs.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, w, h);
          ctx.clip();

          const scale = item.transform?.scale ?? 1.0;
          const panX = item.transform?.offsetX ?? 0;
          const panY = item.transform?.offsetY ?? 0;

          const drawW = w * scale;
          const drawH = h * scale;
          const drawX = - (drawW - w) / 2 + (panX / 100) * w;
          const drawY = - (drawH - h) / 2 + (panY / 100) * h;

          ctx.drawImage(vid, drawX, drawY, drawW, drawH);
          ctx.restore();

          const rawText = item.customText || item.defaultText;
          const textToDraw = formatCaptionText(rawText, subtitleStyle.textTransform);
          if (textToDraw) {
            const fontSize = Math.round((subtitleStyle.fontSize || 40) * (w / 1200));
            ctx.font = `${subtitleStyle.fontWeight || 'bold'} ${fontSize}px "${subtitleStyle.fontFamily || 'Inter'}", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const textY = h * ((subtitleStyle.positionY ?? 85) / 100);
            const textX = w / 2;

            if (subtitleStyle.strokeEnabled) {
              ctx.lineJoin = 'round';
              ctx.lineCap = 'round';
              ctx.miterLimit = 2;
              ctx.strokeStyle = subtitleStyle.strokeColor || '#000000';
              ctx.lineWidth = (subtitleStyle.strokeWidth || 3) * (fontSize / 40);
              ctx.strokeText(textToDraw, textX, textY);
            }

            ctx.fillStyle = subtitleStyle.textColor || '#ffffff';
            ctx.fillText(textToDraw, textX, textY);
          }

          const dataUrl = cvs.toDataURL('image/png');
          const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
          const filename = `frame_${String(i + 1).padStart(2, '0')}_seg_${item.segmentIndex + 1}.png`;
          framesFolder?.file(filename, base64Data, { base64: true });
        }
      }

      // 2. Render all Canvas Compositions
      for (let cIdx = 0; cIdx < canvases.length; cIdx++) {
        const canvasComp = canvases[cIdx];
        setZipProgress(`Canvas ${cIdx + 1}/${canvases.length}`);

        const canvasCvs = await renderCanvasToOffscreen(canvasComp, stagedItems, videoUrl, subtitleStyle);
        if (canvasCvs) {
          const dataUrl = canvasCvs.toDataURL('image/png');
          const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
          const sanitizedTitle = canvasComp.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const filename = `canvas_${String(cIdx + 1).padStart(2, '0')}_${sanitizedTitle}.png`;
          canvasesFolder?.file(filename, base64Data, { base64: true });
        }
      }

      // 3. Save ZIP file
      setZipProgress('Zipping...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `capsync_export_${Date.now()}.zip`;
      link.click();
    } catch (err) {
      console.error('Error generating ZIP export:', err);
    } finally {
      setIsZipping(false);
      setZipProgress('');
    }
  };

  const handleExportFramesZip = async () => {
    if (!videoUrl || stagedItems.length === 0) return;
    setIsZipping(true);
    setZipProgress('Preparing frames...');

    try {
      const zip = new JSZip();
      const framesFolder = zip.folder('staged_frames');

      for (let i = 0; i < stagedItems.length; i++) {
        const item = stagedItems[i];
        setZipProgress(`Frame ${i + 1}/${stagedItems.length}`);

        const vid = document.createElement('video');
        vid.crossOrigin = 'anonymous';
        vid.muted = true;

        await new Promise<void>((resolve) => {
          let timer = setTimeout(resolve, 2500);
          vid.onloadedmetadata = () => {
            vid.currentTime = Math.max(0, item.frameTime);
          };
          vid.onseeked = () => {
            clearTimeout(timer);
            resolve();
          };
          vid.onerror = () => {
            clearTimeout(timer);
            resolve();
          };
          vid.src = videoUrl;
        });

        const cvs = document.createElement('canvas');
        const w = vid.videoWidth || 1920;
        const h = vid.videoHeight || 1080;
        cvs.width = w;
        cvs.height = h;
        const ctx = cvs.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, w, h);
          ctx.clip();

          const scale = item.transform?.scale ?? 1.0;
          const panX = item.transform?.offsetX ?? 0;
          const panY = item.transform?.offsetY ?? 0;

          const drawW = w * scale;
          const drawH = h * scale;
          const drawX = - (drawW - w) / 2 + (panX / 100) * w;
          const drawY = - (drawH - h) / 2 + (panY / 100) * h;

          ctx.drawImage(vid, drawX, drawY, drawW, drawH);
          ctx.restore();

          const rawText = item.customText || item.defaultText;
          const textToDraw = formatCaptionText(rawText, subtitleStyle.textTransform);
          if (textToDraw) {
            const fontSize = Math.round((subtitleStyle.fontSize || 40) * (w / 1200));
            ctx.font = `${subtitleStyle.fontWeight || 'bold'} ${fontSize}px "${subtitleStyle.fontFamily || 'Inter'}", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const textY = h * ((subtitleStyle.positionY ?? 85) / 100);
            const textX = w / 2;

            if (subtitleStyle.strokeEnabled) {
              ctx.lineJoin = 'round';
              ctx.lineCap = 'round';
              ctx.miterLimit = 2;
              ctx.strokeStyle = subtitleStyle.strokeColor || '#000000';
              ctx.lineWidth = (subtitleStyle.strokeWidth || 3) * (fontSize / 40);
              ctx.strokeText(textToDraw, textX, textY);
            }

            ctx.fillStyle = subtitleStyle.textColor || '#ffffff';
            ctx.fillText(textToDraw, textX, textY);
          }

          const dataUrl = cvs.toDataURL('image/png');
          const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
          const filename = `frame_${String(i + 1).padStart(2, '0')}_seg_${item.segmentIndex + 1}.png`;
          framesFolder?.file(filename, base64Data, { base64: true });
        }
      }

      setZipProgress('Zipping...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `staged_frames_${Date.now()}.zip`;
      link.click();
    } catch (err) {
      console.error('Error generating frames ZIP export:', err);
    } finally {
      setIsZipping(false);
      setZipProgress('');
    }
  };

  const handleExportCanvasesZip = async () => {
    if (!videoUrl || canvases.length === 0) return;
    setIsZipping(true);
    setZipProgress('Preparing canvases...');

    try {
      const zip = new JSZip();
      const canvasesFolder = zip.folder('canvases');

      for (let cIdx = 0; cIdx < canvases.length; cIdx++) {
        const canvasComp = canvases[cIdx];
        setZipProgress(`Canvas ${cIdx + 1}/${canvases.length}`);

        const canvasCvs = await renderCanvasToOffscreen(canvasComp, stagedItems, videoUrl, subtitleStyle);
        if (canvasCvs) {
          const dataUrl = canvasCvs.toDataURL('image/png');
          const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
          const sanitizedTitle = canvasComp.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const filename = `canvas_${String(cIdx + 1).padStart(2, '0')}_${sanitizedTitle}.png`;
          canvasesFolder?.file(filename, base64Data, { base64: true });
        }
      }

      setZipProgress('Zipping...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `panel_canvases_${Date.now()}.zip`;
      link.click();
    } catch (err) {
      console.error('Error generating canvases ZIP export:', err);
    } finally {
      setIsZipping(false);
      setZipProgress('');
    }
  };

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId) || canvases[0];
  const activeCanvasFrameIds = activeCanvas ? activeCanvas.frameIds : [];

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden relative">
      {/* Hidden Master Video Element for Canvas Rendering */}
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          preload="auto"
          muted
          crossOrigin="anonymous"
          className="hidden"
        />
      )}

      {/* Top Navbar */}
      <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.push('/editor')}
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Video Editor</span>
          </Button>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-purple-400" />
            <h1 className="font-bold text-base bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Image & Panel Creator
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportFramesZip}
            disabled={isZipping || stagedItems.length === 0}
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs border-purple-500/40 text-purple-300 hover:bg-purple-950/40 font-semibold flex items-center gap-1.5"
            title="Export individual frame images into a ZIP"
          >
            <Archive className="w-3.5 h-3.5 text-purple-400" />
            <span>Export Frames (ZIP)</span>
          </Button>

          <Button
            onClick={handleExportCanvasesZip}
            disabled={isZipping || canvases.length === 0}
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs border-indigo-500/40 text-indigo-300 hover:bg-indigo-950/40 font-semibold flex items-center gap-1.5"
            title="Export all multi-panel canvas compositions into a ZIP"
          >
            <Archive className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export Canvases (ZIP)</span>
          </Button>

          <Button
            onClick={handleExportZipArchive}
            disabled={isZipping || (stagedItems.length === 0 && canvases.length === 0)}
            size="sm"
            className="h-8 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md"
            title="Export frames & canvases into one ZIP"
          >
            <Archive className="w-4 h-4" />
            <span>{isZipping ? zipProgress || 'Zipping...' : 'Export All (ZIP)'}</span>
          </Button>

          <Button
            onClick={handleCreateNewCanvas}
            variant="outline"
            size="sm"
            className="gap-1.5 border-purple-500/40 text-purple-300 hover:bg-purple-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>New Canvas</span>
          </Button>
        </div>
      </header>

      {/* Main Workspace Layout (3-Column Split) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Column 1: Left Staging Tray (Wider: w-96 min-w-[380px]) */}
        <div className="w-96 min-w-[380px] border-r border-border bg-card/50 flex flex-col shrink-0">
          <div className="p-3 border-b border-border flex justify-between items-center bg-card">
            <div className="flex items-center gap-2 font-semibold text-xs text-purple-300">
              <Layers className="w-4 h-4" />
              <span>Staging Tray ({stagedItems.length})</span>
            </div>

            {stagedItems.length > 0 && (
              <button
                onClick={handleToggleSelectAll}
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-950/40 border border-purple-800/40 px-2 py-1 rounded-md"
              >
                {selectedFrameIds.length === stagedItems.length ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5" /> Deselect All
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5" /> Select All ({selectedFrameIds.length})
                  </>
                )}
              </button>
            )}
          </div>

          {/* Staged Items List inside ScrollArea */}
          <ScrollArea className="flex-1 h-0 bg-transparent">
            <div className="p-4 flex flex-col gap-4 pb-20">
              {stagedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-6 text-muted-foreground gap-2 my-auto">
                  <Grid className="w-8 h-8 text-purple-400/40" />
                  <span className="text-xs font-medium">No captions staged yet.</span>
                  <span className="text-[11px] text-muted-foreground/70">
                    Transcribe a video or select captions in the Video Editor and click "Create Panels".
                  </span>
                  <Button
                    onClick={() => router.push('/editor')}
                    size="sm"
                    variant="outline"
                    className="mt-2 text-xs"
                  >
                    Go to Video Editor
                  </Button>
                </div>
              ) : (
                stagedItems.map((item, idx) => (
                  <PanelScrubberCard
                    key={item.id}
                    item={item}
                    trayIndex={idx}
                    videoSrc={videoUrl}
                    isSelected={selectedFrameIds.includes(item.id)}
                    isInActiveCanvas={activeCanvasFrameIds.includes(item.id)}
                    onToggleSelect={handleToggleSelectFrame}
                    onUpdateItem={handleUpdateItem}
                    onRemoveItem={handleRemoveItem}
                    onAddToCanvas={handleAddFrameToCanvas}
                    canvases={canvases}
                    onExportSingleFrame={handleExportSingleFrame}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Column 2: Center Canvases Workspace (Vertically Stacked Canvases in ScrollArea) */}
        <div className="flex-1 flex flex-col bg-background/50 overflow-hidden">
          <header className="h-12 border-b border-border bg-card px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-xs text-foreground uppercase tracking-wider">
                Canvas Compositions ({canvases.length})
              </span>
            </div>

            <Button
              onClick={handleCreateNewCanvas}
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-purple-500/40 text-purple-300 hover:bg-purple-950/40 font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Canvas</span>
            </Button>
          </header>

          <ScrollArea className="flex-1 h-0">
            <div className="p-6 flex flex-col gap-8 items-center justify-start max-w-5xl mx-auto pb-28">
              {canvases.length === 0 ? (
                <div className="my-auto flex flex-col items-center justify-center gap-3 text-muted-foreground py-20">
                  <Sparkles className="w-10 h-10 text-purple-400/40" />
                  <span className="text-sm font-medium">No canvas compositions created yet.</span>
                  <span className="text-xs text-muted-foreground/70 text-center max-w-xs">
                    Create a new canvas or select frames in the Staging Tray to generate panel compositions.
                  </span>
                  <Button onClick={handleCreateNewCanvas} className="bg-purple-600 hover:bg-purple-500 text-xs mt-1">
                    <Plus className="w-4 h-4 mr-1" /> Create Canvas
                  </Button>
                </div>
              ) : (
                canvases.map((c) => (
                  <div key={c.id} className="w-full max-w-4xl">
                    <CanvasCompositor
                      canvas={c}
                      stagedItems={stagedItems}
                      videoSrc={videoUrl}
                      subtitleStyle={subtitleStyle}
                      onUpdateCanvas={handleUpdateCanvas}
                      onDeleteCanvas={handleDeleteCanvas}
                      onRemoveFrameFromCanvas={handleRemoveFrameFromCanvas}
                      isActive={activeCanvasId === c.id}
                      onSelect={() => setActiveCanvasId(c.id)}
                    />
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Column 3: Right Styling & Borders Settings */}
        {activeCanvas && (
          <PanelStyleControls
            canvas={activeCanvas}
            frameCount={activeCanvas.frameIds.length}
            onUpdateCanvas={handleUpdateCanvas}
            onUpdateAllCanvases={(updater) => setCanvases((prev) => prev.map(updater))}
            globalSubtitleStyle={subtitleStyle}
            onUpdateGlobalSubtitleStyle={setSubtitleStyle}
          />
        )}
      </div>

      {/* Floating Bottom Bulk Action Toolbar when frames are selected */}
      <BulkActionToolbar
        selectedCount={selectedFrameIds.length}
        canvases={canvases}
        onCreateCanvasWithSelected={handleCreateCanvasWithSelected}
        onAddToCanvas={handleAddSelectedToCanvas}
        onDownloadSelected={handleDownloadSelectedFrames}
        onExportZip={handleExportZipArchive}
        onRemoveSelected={handleRemoveSelectedFrames}
        onClearSelection={() => setSelectedFrameIds([])}
      />
    </div>
  );
}

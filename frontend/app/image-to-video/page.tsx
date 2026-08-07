'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, Plus, Trash2, Copy, ArrowLeft, ArrowRight, Play, Pause, 
  RotateCcw, Download, Music, Monitor, Smartphone, Square, Layout, 
  Sliders, Film, Sparkles, Loader2, Volume2, Check, RefreshCw, Layers, FileImage
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlideImage {
  id: string;
  file: File;
  previewUrl: string;
  duration: number; // in seconds
  width: number;
  height: number;
}

type AspectRatioPreset = '16:9' | '9:16' | '1:1' | '4:5' | '21:9' | 'custom';
type FitMode = 'contain' | 'cover' | 'stretch';
type TransitionType = 'none' | 'fade' | 'zoom' | 'slide';

const DIMENSION_PRESETS: Record<Exclude<AspectRatioPreset, 'custom'>, { name: string; width: number; height: number; icon: any; label: string }> = {
  '16:9': { name: 'Landscape', width: 1920, height: 1080, icon: Monitor, label: '16:9 (1920x1080)' },
  '9:16': { name: 'Portrait / Shorts', width: 1080, height: 1920, icon: Smartphone, label: '9:16 (1080x1920)' },
  '1:1': { name: 'Square', width: 1080, height: 1080, icon: Square, label: '1:1 (1080x1080)' },
  '4:5': { name: 'Social Feed', width: 1080, height: 1350, icon: Layout, label: '4:5 (1080x1350)' },
  '21:9': { name: 'Ultrawide', width: 2560, height: 1080, icon: Monitor, label: '21:9 (2560x1080)' },
};

export default function ImageToVideoPage() {
  // Slides & order state
  const [images, setImages] = useState<SlideImage[]>([]);
  
  // Settings state
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>('16:9');
  const [customWidth, setCustomWidth] = useState<number>(1920);
  const [customHeight, setCustomHeight] = useState<number>(1080);
  const [fitMode, setFitMode] = useState<FitMode>('contain');
  const [transition, setTransition] = useState<TransitionType>('fade');
  const [transitionDuration, setTransitionDuration] = useState<number>(0.5); // seconds
  const [batchDurationInput, setBatchDurationInput] = useState<string>('3.0');

  // Background Audio State
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState<number>(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  
  // Rendering & Export State
  const [isExportingClient, setIsExportingClient] = useState<boolean>(false);
  const [isExportingServer, setIsExportingServer] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Loaded Image Element Cache
  const loadedImageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Canvas & Animation Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Calculate current dimensions based on preset or custom
  const videoWidth = aspectRatio === 'custom' ? customWidth : DIMENSION_PRESETS[aspectRatio].width;
  const videoHeight = aspectRatio === 'custom' ? customHeight : DIMENSION_PRESETS[aspectRatio].height;

  // Calculate Total Duration
  const totalDuration = images.reduce((acc, img) => acc + img.duration, 0);

  // Preload Image Elements when `images` array changes
  useEffect(() => {
    images.forEach((img) => {
      if (!loadedImageElementsRef.current.has(img.id)) {
        const el = new Image();
        el.src = img.previewUrl;
        loadedImageElementsRef.current.set(img.id, el);
      }
    });
  }, [images]);

  // Audio object handling
  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
    }
  }, [audioFile]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioVolume;
    }
  }, [audioVolume]);

  // Get active image index & offset for a given time point
  const getSlideAtTime = useCallback((time: number) => {
    if (images.length === 0) return null;
    let accumulated = 0;
    for (let i = 0; i < images.length; i++) {
      const duration = images[i].duration;
      if (time >= accumulated && time < accumulated + duration) {
        const localTime = time - accumulated;
        return {
          index: i,
          image: images[i],
          localTime,
          duration,
          accumulated,
          nextImage: images[i + 1] || null
        };
      }
      accumulated += duration;
    }
    // If exact end or past
    const lastIdx = images.length - 1;
    return {
      index: lastIdx,
      image: images[lastIdx],
      localTime: images[lastIdx].duration,
      duration: images[lastIdx].duration,
      accumulated: accumulated - images[lastIdx].duration,
      nextImage: null
    };
  }, [images]);

  // Render a specific frame on Canvas
  const renderFrame = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    // Clear canvas
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    if (images.length === 0) {
      ctx.fillStyle = '#71717a';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Upload images to preview video', width / 2, height / 2);
      return;
    }

    const currentSlide = getSlideAtTime(time);
    if (!currentSlide) return;

    const { index, image, localTime, duration, nextImage } = currentSlide;
    const imgElement = loadedImageElementsRef.current.get(image.id);

    if (!imgElement || !imgElement.complete) return;

    // Helper to draw single image with fitMode
    const drawSingleImage = (
      imgEl: HTMLImageElement, 
      alpha: number = 1.0, 
      scaleFactor: number = 1.0, 
      offsetX: number = 0, 
      offsetY: number = 0
    ) => {
      ctx.save();
      ctx.globalAlpha = alpha;

      const imgWidth = imgEl.naturalWidth || imgEl.width;
      const imgHeight = imgEl.naturalHeight || imgEl.height;

      if (fitMode === 'contain') {
        // Draw blurred background to fill video aspect ratio nicely
        ctx.save();
        ctx.filter = 'blur(30px) brightness(0.5)';
        ctx.drawImage(imgEl, -width * 0.1, -height * 0.1, width * 1.2, height * 1.2);
        ctx.restore();

        // Draw foreground contained image
        const scale = Math.min(width / imgWidth, height / imgHeight) * scaleFactor;
        const targetW = imgWidth * scale;
        const targetH = imgHeight * scale;
        const x = (width - targetW) / 2 + offsetX;
        const y = (height - targetH) / 2 + offsetY;

        ctx.drawImage(imgEl, x, y, targetW, targetH);

      } else if (fitMode === 'cover') {
        const scale = Math.max(width / imgWidth, height / imgHeight) * scaleFactor;
        const targetW = imgWidth * scale;
        const targetH = imgHeight * scale;
        const x = (width - targetW) / 2 + offsetX;
        const y = (height - targetH) / 2 + offsetY;

        ctx.drawImage(imgEl, x, y, targetW, targetH);

      } else if (fitMode === 'stretch') {
        ctx.drawImage(imgEl, offsetX, offsetY, width * scaleFactor, height * scaleFactor);
      }

      ctx.restore();
    };

    // Check transition near the end of current slide
    const timeRemaining = duration - localTime;
    const isTransitioning = transition !== 'none' && nextImage && timeRemaining <= transitionDuration;

    if (isTransitioning && nextImage) {
      const nextImgElement = loadedImageElementsRef.current.get(nextImage.id);
      const progress = (transitionDuration - timeRemaining) / transitionDuration;

      if (transition === 'fade') {
        drawSingleImage(imgElement, 1.0);
        if (nextImgElement && nextImgElement.complete) {
          drawSingleImage(nextImgElement, progress);
        }
      } else if (transition === 'zoom') {
        drawSingleImage(imgElement, 1.0 - progress * 0.5, 1.0 + progress * 0.1);
        if (nextImgElement && nextImgElement.complete) {
          drawSingleImage(nextImgElement, progress, 0.9 + progress * 0.1);
        }
      } else if (transition === 'slide') {
        const shiftX = width * progress;
        drawSingleImage(imgElement, 1.0, 1.0, -shiftX, 0);
        if (nextImgElement && nextImgElement.complete) {
          drawSingleImage(nextImgElement, 1.0, 1.0, width - shiftX, 0);
        }
      } else {
        drawSingleImage(imgElement, 1.0);
      }
    } else {
      drawSingleImage(imgElement, 1.0);
    }

  }, [images, fitMode, transition, transitionDuration, getSlideAtTime]);

  // Update Canvas whenever currentTime or settings change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      renderFrame(ctx, videoWidth, videoHeight, currentTime);
    }
  }, [currentTime, videoWidth, videoHeight, renderFrame]);

  // Animation Loop for Playback
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      lastTimeRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return;
    }

    if (audioRef.current && audioUrl) {
      audioRef.current.currentTime = currentTime;
      audioRef.current.play().catch(() => {});
    }

    const loop = (now: number) => {
      if (lastTimeRef.current !== null) {
        const delta = (now - lastTimeRef.current) / 1000;
        setCurrentTime((prevTime) => {
          const nextTime = prevTime + delta;
          if (nextTime >= totalDuration) {
            setIsPlaying(false);
            return 0; // Loop back to start
          }
          return nextTime;
        });
      }
      lastTimeRef.current = now;
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, totalDuration, currentTime, audioUrl]);

  // Image Upload Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    addFilesToSlides(files);
  };

  const addFilesToSlides = (files: File[]) => {
    const newSlides: SlideImage[] = [];

    files.forEach((file) => {
      if (!file.type.startsWith('image/')) return;

      const previewUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = previewUrl;
      img.onload = () => {
        const slide: SlideImage = {
          id: Math.random().toString(36).substring(2, 9),
          file,
          previewUrl,
          duration: parseFloat(batchDurationInput) || 3.0,
          width: img.naturalWidth || 1920,
          height: img.naturalHeight || 1080
        };
        setImages((prev) => [...prev, slide]);
      };
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      addFilesToSlides(Array.from(e.dataTransfer.files));
    }
  };

  // Reorder & Slide Modifications
  const moveImage = (index: number, direction: 'left' | 'right') => {
    if (direction === 'left' && index === 0) return;
    if (direction === 'right' && index === images.length - 1) return;

    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    const updated = [...images];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setImages(updated);
  };

  const deleteImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const duplicateImage = (index: number) => {
    const original = images[index];
    const copy: SlideImage = {
      ...original,
      id: Math.random().toString(36).substring(2, 9),
    };
    const updated = [...images];
    updated.splice(index + 1, 0, copy);
    setImages(updated);
  };

  const updateSlideDuration = (id: string, duration: number) => {
    const valid = Math.max(0.5, duration);
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, duration: valid } : img))
    );
  };

  const applyBatchDuration = () => {
    const val = Math.max(0.5, parseFloat(batchDurationInput) || 3.0);
    setImages((prev) => prev.map((img) => ({ ...img, duration: val })));
    setStatusMessage(`Applied ${val}s duration to all images`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Fast Browser Client-Side Export (WebM / MediaRecorder)
  const exportVideoClient = async () => {
    if (images.length === 0) return;
    setIsExportingClient(true);
    setIsPlaying(false);
    setExportProgress(0);
    setStatusMessage('Preparing client-side video recorder...');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not initialize canvas context');

      const stream = canvas.captureStream(30);
      
      // If background audio is active, mix audio stream
      let mediaRecorder: MediaRecorder;
      const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=h264')
        ? 'video/mp4;codecs=h264'
        : 'video/webm;codecs=vp9';

      mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `slideshow_${videoWidth}x${videoHeight}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
        a.click();
        URL.revokeObjectURL(url);
        setIsExportingClient(false);
        setStatusMessage('Video exported successfully!');
        setTimeout(() => setStatusMessage(null), 4000);
      };

      mediaRecorder.start();

      const fps = 30;
      const frameDuration = 1 / fps;
      let renderTime = 0;

      const processNextFrame = () => {
        if (renderTime >= totalDuration) {
          mediaRecorder.stop();
          return;
        }

        renderFrame(ctx, videoWidth, videoHeight, renderTime);
        renderTime += frameDuration;
        setExportProgress(Math.min(100, Math.round((renderTime / totalDuration) * 100)));

        setTimeout(processNextFrame, 1000 / fps);
      };

      processNextFrame();

    } catch (err: any) {
      console.error(err);
      setStatusMessage(`Client export error: ${err.message}`);
      setIsExportingClient(false);
    }
  };

  // High Quality Backend Server-Side Export (FFmpeg MP4)
  const exportVideoServer = async () => {
    if (images.length === 0) return;
    setIsExportingServer(true);
    setIsPlaying(false);
    setStatusMessage('Sending render task to FFmpeg engine...');

    try {
      const formData = new FormData();

      const config = {
        width: videoWidth,
        height: videoHeight,
        fitMode,
        transition,
        transitionDuration,
        fps: 30,
        images: images.map((img, idx) => ({
          index: idx,
          duration: img.duration,
        })),
      };

      formData.append('config', JSON.stringify(config));

      // Append image files
      images.forEach((img, idx) => {
        formData.append(`image_${idx}`, img.file);
      });

      // Append audio file if exists
      if (audioFile) {
        formData.append('audio', audioFile);
      }

      const res = await fetch('/api/render-slideshow', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Server rendering failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `capsync_slideshow_${videoWidth}x${videoHeight}.mp4`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMessage('HD MP4 Video rendered & downloaded successfully!');
      setTimeout(() => setStatusMessage(null), 4000);

    } catch (err: any) {
      console.error(err);
      setStatusMessage(`Render Error: ${err.message}`);
    } finally {
      setIsExportingServer(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white overflow-y-auto">
      {/* Background Audio Hidden Tag */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/60 px-8 py-5 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/20">
              <Film className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Image to Video Creator
                <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono font-medium">
                  Studio Tool
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Transform image sets into dynamic videos with selectable dimensions, order, and timing.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Badges & Actions */}
        <div className="flex items-center gap-4">
          {statusMessage && (
            <div className="text-xs px-3 py-1.5 rounded-lg bg-blue-950/80 border border-blue-700/50 text-blue-300 animate-fade-in flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              {statusMessage}
            </div>
          )}

          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-300">
            <span className="text-zinc-500">Images:</span>
            <span className="text-white font-semibold">{images.length}</span>
            <span className="text-zinc-700">|</span>
            <span className="text-zinc-500">Length:</span>
            <span className="text-blue-400 font-semibold">{totalDuration.toFixed(1)}s</span>
            <span className="text-zinc-700">|</span>
            <span className="text-zinc-500">Size:</span>
            <span className="text-purple-400 font-semibold">{videoWidth}×{videoHeight}</span>
          </div>

          <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-md shadow-blue-600/20">
            <Plus className="w-4 h-4" />
            Add Images
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              className="hidden" 
              onChange={handleFileUpload} 
            />
          </label>
        </div>
      </header>

      {/* Main Studio Grid */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] w-full mx-auto flex-1">
        
        {/* Left Column: Canvas Preview Player & Export (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Canvas Wrapper Card */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden group shadow-xl">
            {/* Resolution indicator banner */}
            <div className="absolute top-3 left-4 z-10 bg-zinc-950/80 backdrop-blur-sm border border-zinc-800/80 px-2.5 py-1 rounded-md text-[11px] font-mono text-zinc-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {aspectRatio.toUpperCase()} ({videoWidth} × {videoHeight}) • {fitMode}
            </div>

            {/* Active Image File Name Badge */}
            {images.length > 0 && getSlideAtTime(currentTime) && (
              <div 
                className="absolute top-3 right-4 z-10 bg-zinc-950/85 backdrop-blur-sm border border-zinc-800/80 px-2.5 py-1 rounded-md text-[11px] font-mono text-blue-300 flex items-center gap-1.5 max-w-[260px] shadow-sm"
                title={getSlideAtTime(currentTime)?.image.file.name}
              >
                <FileImage className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">{getSlideAtTime(currentTime)?.image.file.name}</span>
              </div>
            )}

            {/* Canvas Preview Container */}
            <div className="w-full flex items-center justify-center min-h-[380px] max-h-[520px] py-4 bg-zinc-950/50 rounded-xl relative">
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-[460px] object-contain rounded-lg shadow-2xl border border-zinc-800/60"
              />

              {images.length === 0 && (
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-zinc-800 rounded-xl hover:border-blue-500/50 transition-colors cursor-pointer"
                >
                  <div className="p-4 bg-zinc-900/90 rounded-full border border-zinc-800 mb-3 text-zinc-400 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1">Drag & Drop Images Here</h3>
                  <p className="text-xs text-zinc-400 mb-4 max-w-sm">
                    Upload your photo collection to automatically render a video slideshow.
                  </p>
                  <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold px-4 py-2 rounded-lg border border-zinc-700 transition-colors">
                    Browse Computer
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      className="hidden" 
                      onChange={handleFileUpload} 
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Video Playback Scrubber & Controls */}
            {images.length > 0 && (
              <div className="w-full mt-4 flex flex-col gap-3 bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/60">
                {/* Timeline Scrubber */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-zinc-400 w-12 text-right">
                    {currentTime.toFixed(1)}s
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={totalDuration || 1}
                    step="0.1"
                    value={currentTime}
                    onChange={(e) => {
                      setCurrentTime(parseFloat(e.target.value));
                      if (isPlaying) setIsPlaying(false);
                    }}
                    className="flex-1 accent-blue-500 bg-zinc-800 h-2 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono text-zinc-400 w-12">
                    {totalDuration.toFixed(1)}s
                  </span>
                </div>

                {/* Play / Reset buttons */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-md shadow-blue-600/20"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-4 h-4" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" /> Play Preview
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentTime(0);
                      }}
                      className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors text-xs font-medium flex items-center gap-1"
                      title="Reset to start"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-xs text-zinc-400 flex items-center gap-2 font-mono">
                    <span>Fit Mode:</span>
                    <span className="text-white capitalize bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                      {fitMode}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export Actions Panel */}
          {images.length > 0 && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-400" />
                    Export Video Options
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Choose instant browser download or high quality server rendering.
                  </p>
                </div>
              </div>

              {/* Export Progress Bar */}
              {(isExportingClient || isExportingServer) && (
                <div className="flex flex-col gap-2 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-blue-400 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {isExportingClient ? 'Client Recording...' : 'FFmpeg Server Encoding...'}
                    </span>
                    <span className="text-zinc-400">{exportProgress}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full transition-all duration-200"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Instant Client WebM/MP4 */}
                <button
                  onClick={exportVideoClient}
                  disabled={isExportingClient || isExportingServer}
                  className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-xl font-medium text-xs flex flex-col items-start gap-1 transition-all disabled:opacity-50"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-blue-400">Instant Export (Browser)</span>
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    Fast zero-latency WebM/MP4 generated in browser.
                  </span>
                </button>

                {/* High Quality FFmpeg MP4 */}
                <button
                  onClick={exportVideoServer}
                  disabled={isExportingClient || isExportingServer}
                  className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-medium text-xs flex flex-col items-start gap-1 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold">Render HD MP4 (Server FFmpeg)</span>
                    <Film className="w-3.5 h-3.5 text-indigo-200" />
                  </div>
                  <span className="text-[11px] text-indigo-100/70">
                    Pristine H.264 MP4 export with audio sync & full resolution.
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Settings & Configuration Controls (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          
          {/* Dimension & Aspect Ratio Selector */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Monitor className="w-4 h-4 text-blue-400" />
              1. Video Dimensions & Aspect Ratio
            </h3>

            {/* Presets Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(DIMENSION_PRESETS) as Array<keyof typeof DIMENSION_PRESETS>).map((key) => {
                const preset = DIMENSION_PRESETS[key];
                const Icon = preset.icon;
                const isSelected = aspectRatio === key;

                return (
                  <button
                    key={key}
                    onClick={() => setAspectRatio(key)}
                    className={cn(
                      "p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all",
                      isSelected 
                        ? "bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-500/10" 
                        : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className={cn("w-4 h-4", isSelected ? "text-blue-400" : "text-zinc-500")} />
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                        {key}
                      </span>
                    </div>
                    <span className="text-xs font-medium leading-none">{preset.name}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{preset.width}x{preset.height}</span>
                  </button>
                );
              })}

              {/* Custom option */}
              <button
                onClick={() => setAspectRatio('custom')}
                className={cn(
                  "p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all",
                  aspectRatio === 'custom'
                    ? "bg-blue-600/20 border-blue-500 text-white"
                    : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
                )}
              >
                <div className="flex items-center justify-between">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                    CUSTOM
                  </span>
                </div>
                <span className="text-xs font-medium leading-none">Custom Dimensions</span>
                <span className="text-[10px] font-mono text-zinc-500">WxH Manual</span>
              </button>
            </div>

            {/* Custom Input Fields if aspect ratio === 'custom' */}
            {aspectRatio === 'custom' && (
              <div className="grid grid-cols-2 gap-3 pt-2 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                <div>
                  <label className="text-[11px] font-mono text-zinc-400 mb-1 block">Width (px)</label>
                  <input
                    type="number"
                    min="320"
                    max="3840"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(parseInt(e.target.value) || 1080)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-400 mb-1 block">Height (px)</label>
                  <input
                    type="number"
                    min="320"
                    max="3840"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(parseInt(e.target.value) || 1080)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Image Fitting Mode */}
            <div className="pt-2 border-t border-zinc-800">
              <label className="text-xs font-semibold text-zinc-300 mb-2 block">Image Fit Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { mode: 'contain', label: 'Contain', desc: 'Blurred background' },
                  { mode: 'cover', label: 'Cover', desc: 'Crop to fill frame' },
                  { mode: 'stretch', label: 'Stretch', desc: 'Stretch to exact size' },
                ].map(({ mode, label, desc }) => (
                  <button
                    key={mode}
                    onClick={() => setFitMode(mode as FitMode)}
                    className={cn(
                      "p-2.5 rounded-lg border text-left flex flex-col transition-all",
                      fitMode === mode
                        ? "bg-zinc-800 border-blue-500 text-white"
                        : "bg-zinc-950/40 border-zinc-800/80 text-zinc-400 hover:text-white"
                    )}
                  >
                    <span className="text-xs font-semibold">{label}</span>
                    <span className="text-[10px] text-zinc-500">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Batch Duration & Transition Settings */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              2. Timing & Transition Effects
            </h3>

            {/* Batch Duration Setting */}
            <div className="flex items-center gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
              <div className="flex-1">
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Default Duration per Image
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="60"
                    value={batchDurationInput}
                    onChange={(e) => setBatchDurationInput(e.target.value)}
                    className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-zinc-400 font-mono">seconds</span>
                </div>
              </div>
              <button
                onClick={applyBatchDuration}
                disabled={images.length === 0}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium border border-zinc-700 transition-colors disabled:opacity-50"
              >
                Apply to All Images
              </button>
            </div>

            {/* Transition Selector */}
            <div>
              <label className="text-xs font-medium text-zinc-300 mb-2 block">
                Transition Between Images
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'none', label: 'None (Cut)' },
                  { id: 'fade', label: 'Crossfade' },
                  { id: 'zoom', label: 'Zoom' },
                  { id: 'slide', label: 'Slide' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTransition(t.id as TransitionType)}
                    className={cn(
                      "p-2 rounded-lg border text-center text-xs font-medium transition-all",
                      transition === t.id
                        ? "bg-purple-600/20 border-purple-500 text-purple-300"
                        : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-white"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Background Audio Settings */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-emerald-400" />
                3. Background Music (Optional)
              </h3>
              {audioFile && (
                <button
                  onClick={() => setAudioFile(null)}
                  className="text-xs text-red-400 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              )}
            </div>

            {!audioFile ? (
              <label className="cursor-pointer bg-zinc-950/60 hover:bg-zinc-800/80 border border-dashed border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors">
                <Music className="w-6 h-6 text-zinc-500" />
                <span className="text-xs font-medium text-zinc-300">Upload Music Track (MP3/WAV)</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setAudioFile(e.target.files[0]);
                    }
                  }}
                />
              </label>
            ) : (
              <div className="flex flex-col gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                <div className="flex items-center justify-between text-xs font-medium text-emerald-400 truncate">
                  <span className="truncate max-w-[200px]">{audioFile.name}</span>
                  <span className="text-zinc-500 text-[10px] font-mono">
                    {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-zinc-400" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={audioVolume}
                    onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                    className="flex-1 accent-emerald-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                  />
                  <span className="text-[11px] font-mono text-zinc-400 w-8">
                    {Math.round(audioVolume * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Bottom Timeline Section: Uploaded Image Sequence & Ordering */}
      <div className="border-t border-zinc-800 bg-zinc-900/60 p-6 mt-auto">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-400" />
                Image Sequence Timeline
              </h2>
              <span className="text-xs text-zinc-400 font-mono">
                ({images.length} images • Total: {totalDuration.toFixed(1)}s)
              </span>
            </div>

            {images.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setImages([])}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-900/50 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All
                </button>
              </div>
            )}
          </div>

          {/* Cards Grid / Reel */}
          {images.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/40">
              <p className="text-xs text-zinc-500">No images added yet. Click "Add Images" above to build your video timeline.</p>
            </div>
          ) : (
            <div className="flex items-center gap-4 overflow-x-auto pb-4 pt-2 scrollbar-thin scrollbar-thumb-zinc-800">
              {images.map((img, index) => (
                <div
                  key={img.id}
                  className="flex-shrink-0 w-52 bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col gap-3 group hover:border-zinc-700 transition-all shadow-md relative"
                >
                  {/* Position Badge & Order Buttons */}
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/40 text-xs font-mono font-bold flex items-center justify-center">
                      #{index + 1}
                    </span>

                    {/* Order Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveImage(index, 'left')}
                        disabled={index === 0}
                        className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
                        title="Move Left"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveImage(index, 'right')}
                        disabled={index === images.length - 1}
                        className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
                        title="Move Right"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Image File Name Badge */}
                  <div 
                    className="flex items-center gap-1.5 bg-zinc-950/80 px-2 py-1 rounded-md border border-zinc-800/80 text-[11px] font-mono text-zinc-300 w-full overflow-hidden"
                    title={img.file.name}
                  >
                    <FileImage className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">{img.file.name}</span>
                  </div>

                  {/* Image Thumbnail */}
                  <div className="w-full h-32 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800/80 relative">
                    {/* eslint-disable-next-next/no-img-element */}
                    <img 
                      src={img.previewUrl} 
                      alt={`Slide ${index + 1}`} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-1 right-1 bg-zinc-950/80 text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-300">
                      {img.width}×{img.height}
                    </div>
                  </div>

                  {/* Individual Duration Setting */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/60">
                    <label className="text-[11px] font-mono text-zinc-400">Duration:</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="60"
                        value={img.duration}
                        onChange={(e) => updateSlideDuration(img.id, parseFloat(e.target.value) || 1)}
                        className="w-16 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white font-mono text-center outline-none focus:border-blue-500"
                      />
                      <span className="text-[11px] font-mono text-zinc-400">s</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800/40">
                    <button
                      onClick={() => duplicateImage(index)}
                      className="text-zinc-400 hover:text-white flex items-center gap-1 text-[11px] transition-colors"
                      title="Duplicate Image"
                    >
                      <Copy className="w-3 h-3" /> Duplicate
                    </button>
                    <button
                      onClick={() => deleteImage(img.id)}
                      className="text-red-400/80 hover:text-red-400 flex items-center gap-1 text-[11px] transition-colors"
                      title="Delete Image"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

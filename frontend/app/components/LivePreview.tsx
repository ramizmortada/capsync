import { useEffect, useRef, useState } from "react";
import { Video, FileAudio, Maximize2, Minimize2, Download, Loader2, BoxSelect } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LivePreviewProps {
  file: File | null;
  mediaUrl: string;
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  setCurrentTime: (time: number) => void;
  setMediaDuration: (duration: number) => void;
  editableSegments: any[];
  videoSegments: any[];
  cutZones: { start: number; end: number }[];
  currentTime: number;
  subtitleStyle: any; // We'll just pass the object directly
  setVideoDimensions: (dimensions: {width: number, height: number}) => void;
  handleExportVideo?: () => void;
  status?: string;
  togglePlay?: () => void;
  videoCanvas?: any;
  setVideoSegments?: any;
}

export function LivePreview({
  file,
  mediaUrl,
  mediaRef,
  setCurrentTime,
  setMediaDuration,
  editableSegments,
  videoSegments,
  cutZones,
  currentTime,
  subtitleStyle,
  setVideoDimensions,
  handleExportVideo,
  status,
  togglePlay,
  videoCanvas,
  setVideoSegments,
}: LivePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [localVideoDim, setLocalVideoDim] = useState({ width: 1920, height: 1080 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localTime, setLocalTime] = useState(currentTime);
  const [showBounds, setShowBounds] = useState(false);
  
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const dragStartTransformRef = useRef({ x: 0, y: 0 });

  // Sync back to parent when paused/seeking or when master clock ticks
  useEffect(() => {
    setLocalTime(currentTime);
  }, [currentTime]);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      setContainerSize({
        width: entries[0].contentRect.width,
        height: entries[0].contentRect.height
      });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleVideoClick = () => {
    if (togglePlay) {
      togglePlay();
    }
  };

  // Calculate actual video render dimensions inside the object-fit: contain container
  const renderDim = (videoCanvas && videoCanvas.type !== 'auto' && videoCanvas.width && videoCanvas.height) ? videoCanvas : localVideoDim;
  const renderRatio = renderDim.width / renderDim.height;
  let renderWidth = containerSize.width;
  let renderHeight = containerSize.height;
  
  if (containerSize.height > 0 && containerSize.width > 0) {
    const containerRatio = containerSize.width / containerSize.height;
    if (containerRatio > renderRatio) {
      // Container is wider than canvas
      renderHeight = containerSize.height;
      renderWidth = renderHeight * renderRatio;
    } else {
      // Container is taller than canvas
      renderWidth = containerSize.width;
      renderHeight = renderWidth / renderRatio;
    }
  }

  // Determine if we are currently in a video gap
  const activeClip = videoSegments?.find(s => !s.deleted && localTime >= s.sourceStart && localTime < s.sourceEnd);
  const isGap = !videoSegments || !activeClip;
  
  const activeTransform = activeClip?.transform || { x: 0, y: 0, scale: 1 };
  const scaleOnScreen = renderWidth / renderDim.width;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!activeClip || !setVideoSegments) return;
    
    // Only handle left click drag
    if (e.button !== 0) return;
    
    // Check if we clicked on a button or something else, but here we only have video and subtitles.
    // If it's a drag, we prevent click from toggling play.
    isDraggingRef.current = false; // Will set true on move
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    dragStartTransformRef.current = { x: activeTransform.x, y: activeTransform.y };
    
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - dragStartPosRef.current.x;
      const dy = moveEvent.clientY - dragStartPosRef.current.y;
      
      // If moved more than 3 pixels, consider it a drag
      if (!isDraggingRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        isDraggingRef.current = true;
      }
      
      if (isDraggingRef.current) {
        // Convert screen pixel movement to percentage of the video container dimensions
        const dxPercentage = (dx / renderWidth) * 100;
        const dyPercentage = (dy / renderHeight) * 100;
        
        setVideoSegments((prev: any[]) => prev.map((s: any) => 
          s.id === activeClip.id 
            ? { ...s, transform: { ...activeTransform, x: dragStartTransformRef.current.x + dxPercentage, y: dragStartTransformRef.current.y + dyPercentage } } 
            : s
        ));
      }
    };
    
    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      
      // If we didn't drag, it was a click, so we should toggle play
      if (!isDraggingRef.current && togglePlay) {
        togglePlay();
      }
      setTimeout(() => { isDraggingRef.current = false; }, 0);
    };
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div className="h-full rounded-xl overflow-hidden bg-card border border-border shadow-2xl flex flex-col">
      <div className="p-3 bg-muted/20 border-b border-border text-sm font-medium text-muted-foreground flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-emerald-400" /> Live Preview Studio
        </div>
        <div className="flex items-center gap-2">
          {file && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={toggleFullScreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          )}
          {status === "burning" ? (
            <Button disabled size="sm" className="text-xs h-8 flex items-center gap-1.5 font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting...
            </Button>
          ) : (status === "done" && file?.type.startsWith('video') && handleExportVideo) ? (
            <Button onClick={handleExportVideo} size="sm" className="text-xs h-8 flex items-center gap-1.5 font-semibold">
              <Download className="w-3.5 h-3.5" /> Export Video
            </Button>
          ) : null}
        </div>
      </div>
      
      <div 
        ref={containerRef} 
        className="flex-1 flex flex-col relative min-h-[300px] overflow-hidden items-center justify-center bg-neutral-950"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Toggle Bounds Button */}
        <Button
          variant="ghost"
          size="icon"
          className={`absolute top-2 right-2 z-50 rounded-md shadow backdrop-blur transition-all duration-350 border ${showBounds ? 'bg-accent text-accent-foreground border-border hover:bg-accent/80' : 'bg-background/40 text-muted-foreground border-transparent hover:bg-background/60 hover:text-foreground'}`}
          onClick={() => setShowBounds(!showBounds)}
          title="Toggle Container Bounds"
        >
          <BoxSelect className="w-4 h-4" />
        </Button>

        {/* Media Element bounds (Canvas) */}
        <div 
          onPointerDown={handlePointerDown}
          className="relative flex items-center justify-center cursor-pointer overflow-hidden"
          style={{
            width: renderWidth,
            height: renderHeight,
            backgroundColor: videoCanvas?.type !== 'auto' ? videoCanvas?.backgroundColor : 'transparent'
          }}
        >
          {file?.type.startsWith('video') ? (
            <video 
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              src={mediaUrl || undefined} 
              className={`absolute inset-0 w-full h-full bg-transparent object-contain pointer-events-none transition-opacity duration-150 ${isGap ? 'opacity-0' : 'opacity-100'}`}
              style={{
                transform: `translate(${activeTransform.x}%, ${activeTransform.y}%) scale(${activeTransform.scale})`,
                transition: 'transform 0.1s ease-out'
              }}
              onLoadedMetadata={(e) => {
                setMediaDuration(e.currentTarget.duration);
                const dims = {
                  width: e.currentTarget.videoWidth,
                  height: e.currentTarget.videoHeight
                };
                setLocalVideoDim(dims);
                setVideoDimensions(dims);
              }}
            />
          ) : (
            <div className="w-full flex items-center justify-center p-8">
              <audio 
                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                src={mediaUrl || undefined} 
                className="hidden"
                onLoadedMetadata={(e) => setMediaDuration(e.currentTarget.duration)}
              />
              {/* Audio visual placeholder */}
              <div className="w-32 h-32 rounded-full bg-card border border-border flex items-center justify-center shadow-2xl">
                <FileAudio className="w-12 h-12 text-muted-foreground/60" />
              </div>
            </div>
          )}

          {/* Subtitle Overlay (Percentage-Based Absolute Pixels) */}
          <div 
            className="absolute pointer-events-none"
            style={{ 
              width: renderWidth, 
              height: renderHeight,
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%)`,
            }}
          >
            <div 
              className={`absolute left-0 right-0 flex ${
                subtitleStyle.alignment === 'left' ? 'justify-start' : 
                subtitleStyle.alignment === 'right' ? 'justify-end' : 'justify-center'
              }`}
              style={{
                paddingLeft: `${(100 - (subtitleStyle.maxWidth ?? 90)) / 2}%`,
                paddingRight: `${(100 - (subtitleStyle.maxWidth ?? 90)) / 2}%`,
                top: subtitleStyle.alignmentVertical === 'top' 
                  ? `${subtitleStyle.positionY ?? 10}%` 
                  : subtitleStyle.alignmentVertical === 'middle'
                  ? '50%' 
                  : undefined,
                bottom: subtitleStyle.alignmentVertical === 'bottom' || !subtitleStyle.alignmentVertical 
                  ? `${subtitleStyle.positionY ?? 10}%` 
                  : undefined,
                transform: subtitleStyle.alignmentVertical === 'middle' 
                  ? `translateY(calc(-50% + ${subtitleStyle.positionY ?? 0}%))` 
                  : undefined,
                border: showBounds ? '2px dashed var(--ring)' : undefined,
                backgroundColor: showBounds ? 'color-mix(in srgb, var(--ring) 12%, transparent)' : undefined,
              paddingTop: showBounds ? '4px' : undefined,
                paddingBottom: showBounds ? '4px' : undefined,
              }}
            >
              {(() => {
                const activeSegment = editableSegments.find((s: any) => {
                  const isCurrent = localTime >= s.start && localTime < s.end;
                  if (!isCurrent) return false;
                  if (s.words && s.words.length > 0) {
                    return s.words.some((w: any) => !w.deleted && !w.isGap);
                  }
                  return true;
                });
                if (!activeSegment) return null;
                
                const hexToRgba = (hex: string, opacity: number) => {
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
                };

                const generateRoundedStroke = (width: number, color: string) => {
                  if (width <= 0) return 'none';
                  let shadows = [];
                  const step = 2;
                  for (let r = step; r < width; r += step) {
                    const numAngles = Math.max(8, Math.ceil(r * Math.PI));
                    for (let i = 0; i < numAngles; i++) {
                      const rad = (i * 2 * Math.PI) / numAngles;
                      shadows.push(`${(Math.cos(rad) * r).toFixed(1)}px ${(Math.sin(rad) * r).toFixed(1)}px 0 ${color}`);
                    }
                  }
                  const numAngles = Math.max(8, Math.ceil(width * Math.PI));
                  for (let i = 0; i < numAngles; i++) {
                    const rad = (i * 2 * Math.PI) / numAngles;
                    shadows.push(`${(Math.cos(rad) * width).toFixed(1)}px ${(Math.sin(rad) * width).toFixed(1)}px 0 ${color}`);
                  }
                  return shadows.join(', ');
                };

                // Assume standard portrait format of 1080x1920 as the reference layout for pixels
                const VIDEO_REFERENCE_HEIGHT = 1920;
                const scaleRatio = renderHeight / VIDEO_REFERENCE_HEIGHT;

                const pxFontSize = subtitleStyle.fontSize * scaleRatio;
                const pxStroke = subtitleStyle.strokeWidth * scaleRatio;
                const pxShadowBlur = subtitleStyle.shadowBlur * scaleRatio;
                const pxShadowOffsetX = subtitleStyle.shadowOffsetX * scaleRatio;
                const pxShadowOffsetY = subtitleStyle.shadowOffsetY * scaleRatio;
                
                // Box padding uses 0.5% v-padding, 1% h-padding
                const pxPadY = (0.5 / 100) * renderHeight;
                const pxPadX = (1.0 / 100) * renderHeight;
                const pxRadius = pxPadX;
                
                // Box highlight padding
                const pxHighlightPad = (0.6 / 100) * renderHeight;

                let segmentOpacity = 1;
                let segmentScale = 1;

                if (subtitleStyle.animationIn && subtitleStyle.animationIn !== 'none') {
                  const dtIn = localTime - activeSegment.start;
                  const segDur = activeSegment.end - activeSegment.start;
                  const animDur = Math.min(0.2, segDur / 2);

                  if (dtIn < animDur && animDur > 0) {
                    const progress = dtIn / animDur;
                    segmentOpacity = progress;
                    if (subtitleStyle.animationIn === 'zoomIn') {
                      segmentScale = 0.8 + 0.2 * progress;
                    } else if (subtitleStyle.animationIn === 'zoomOut') {
                      segmentScale = 1.2 - 0.2 * progress;
                    }
                  }
                }

                if (subtitleStyle.animationOut && subtitleStyle.animationOut !== 'none') {
                  const dtOut = activeSegment.end - localTime;
                  const segDur = activeSegment.end - activeSegment.start;
                  const animDur = Math.min(0.2, segDur / 2);

                  if (dtOut < animDur && animDur > 0) {
                    const progress = dtOut / animDur; // 1 to 0 as dtOut goes animDur -> 0
                    segmentOpacity = progress;
                    if (subtitleStyle.animationOut === 'zoomIn') {
                      segmentScale = 0.8 + 0.2 * progress;
                    } else if (subtitleStyle.animationOut === 'zoomOut') {
                      segmentScale = 1.2 - 0.2 * progress;
                    }
                  }
                }

                const wrapperStyle: React.CSSProperties = {
                  backgroundColor: subtitleStyle.backgroundEnabled ? hexToRgba(subtitleStyle.backgroundColor, subtitleStyle.backgroundOpacity) : 'transparent',
                  padding: subtitleStyle.backgroundEnabled ? `${pxPadY}px ${pxPadX}px` : '0',
                  borderRadius: subtitleStyle.backgroundEnabled ? `${pxRadius}px` : '0',
                  display: 'inline-block',
                  opacity: segmentOpacity,
                  transform: `scale(${segmentScale})`,
                };

                const textContainerStyle: React.CSSProperties = {
                  fontFamily: subtitleStyle.fontFamily,
                  fontWeight: subtitleStyle.fontWeight,
                  fontSize: `${pxFontSize}px`,
                  textAlign: subtitleStyle.alignment || 'center',
                  lineHeight: '1.2',
                  position: 'relative',
                  display: 'inline-block',
                  textTransform: subtitleStyle.textTransform || 'none',
                };

                let combinedShadows = [];
                if (subtitleStyle.strokeEnabled) {
                  const strokeShadow = generateRoundedStroke(pxStroke, subtitleStyle.strokeColor);
                  if (strokeShadow !== 'none') combinedShadows.push(strokeShadow);
                }
                if (subtitleStyle.shadowEnabled) {
                  if (subtitleStyle.shadow3DEnabled) {
                    const maxSteps = Math.max(Math.abs(pxShadowOffsetX), Math.abs(pxShadowOffsetY));
                    const steps = Math.max(1, Math.ceil(maxSteps));
                    for (let i = 1; i <= steps; i++) {
                      const dx = (pxShadowOffsetX / steps) * i;
                      const dy = (pxShadowOffsetY / steps) * i;
                      combinedShadows.push(`${dx.toFixed(1)}px ${dy.toFixed(1)}px 0 ${subtitleStyle.shadowColor}`);
                    }
                  } else {
                    combinedShadows.push(`${pxShadowOffsetX}px ${pxShadowOffsetY}px ${pxShadowBlur}px ${subtitleStyle.shadowColor}`);
                  }
                }

                // The stroke layer (drawn double thick, under the text)
                const strokeLayerStyle: React.CSSProperties = {
                  position: 'absolute',
                  inset: 0,
                  textShadow: combinedShadows.length > 0 ? combinedShadows.join(', ') : undefined,
                  color: 'transparent',
                  zIndex: 0,
                  pointerEvents: 'none',
                };

                // The front fill layer (no stroke, sits exactly on top)
                const fillLayerStyle: React.CSSProperties = {
                  position: 'relative',
                  color: subtitleStyle.textColor,
                  zIndex: 1,
                };

              // Helper to render words
              const renderWords = (isStrokeLayer: boolean) => {
                if (!activeSegment.words || activeSegment.words.length === 0) {
                  return activeSegment.text.trim();
                }

                const visibleWords = activeSegment.words.filter((word: any) => !word.deleted && !word.isGap);
                if (visibleWords.length === 0) {
                  return "";
                }

                return visibleWords.map((word: any, i: number) => {
                  const isActive = localTime >= word.start && localTime < word.end;
                  const isPast = localTime >= word.end;
                  
                  let wordStyle: React.CSSProperties = {
                    display: 'inline-block',
                    transition: 'all 0.05s ease-out',
                    verticalAlign: subtitleStyle.alignmentVertical === 'top' ? 'top' : subtitleStyle.alignmentVertical === 'middle' ? 'middle' : 'bottom',
                  };

                  if (subtitleStyle.animationStyle === 'reveal' && !isActive && !isPast) {
                    wordStyle.opacity = 0;
                  } else if (subtitleStyle.animationStyle === 'dimmed' && !isActive && !isPast) {
                    wordStyle.opacity = 0.35;
                  } else if (subtitleStyle.animationStyle !== 'none') {
                    if (subtitleStyle.animationStyle === 'box') {
                      if (isActive && isStrokeLayer) {
                        wordStyle.backgroundColor = subtitleStyle.highlightBackgroundColor;
                        wordStyle.padding = `0 ${pxHighlightPad}px`;
                        wordStyle.borderRadius = `${pxHighlightPad}px`;
                        wordStyle.margin = `0 -${pxHighlightPad}px`;
                      }
                    } else if (!isStrokeLayer) {
                      if (isActive) {
                        if (subtitleStyle.animationStyle === 'color' || subtitleStyle.animationStyle === 'dimmed') {
                          wordStyle.color = subtitleStyle.highlightColor;
                        } else if (subtitleStyle.animationStyle === 'scale') {
                          wordStyle.transform = `scale(${subtitleStyle.scaleFactor ?? 1.2})`;
                          wordStyle.color = subtitleStyle.highlightColor;
                          wordStyle.zIndex = 10;
                          wordStyle.position = 'relative';
                        } else if (subtitleStyle.animationStyle === 'karaoke') {
                          wordStyle.color = subtitleStyle.highlightColor;
                        }
                      } else if (isPast && subtitleStyle.animationStyle === 'karaoke') {
                        wordStyle.color = subtitleStyle.highlightColor;
                      }
                    }
                  }

                  return (
                    <span key={`${activeSegment.start}-${i}`} style={wordStyle}>
                      {word.word}{' '}
                    </span>
                  );
                });
              };

              return (
                <div style={wrapperStyle} className="will-change-transform">
                  <div style={textContainerStyle} className="whitespace-pre-wrap">
                    <div style={strokeLayerStyle} aria-hidden="true">
                      {renderWords(true)}
                    </div>
                    <div style={fillLayerStyle}>
                      {renderWords(false)}
                    </div>
                  </div>
                </div>
              );
            })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

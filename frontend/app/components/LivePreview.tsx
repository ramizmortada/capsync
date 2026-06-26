import { useEffect, useRef, useState } from "react";
import { Video, FileAudio, Maximize2, Minimize2, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LivePreviewProps {
  file: File | null;
  mediaUrl: string;
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  setCurrentTime: (time: number) => void;
  setMediaDuration: (duration: number) => void;
  editableSegments: any[];
  currentTime: number;
  subtitleStyle: any; // We'll just pass the object directly
  setVideoDimensions: (dimensions: {width: number, height: number}) => void;
  handleExportVideo?: () => void;
  status?: string;
}

export function LivePreview({
  file,
  mediaUrl,
  mediaRef,
  setCurrentTime,
  setMediaDuration,
  editableSegments,
  currentTime,
  subtitleStyle,
  setVideoDimensions,
  handleExportVideo,
  status,
}: LivePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [localVideoDim, setLocalVideoDim] = useState({ width: 1920, height: 1080 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localTime, setLocalTime] = useState(currentTime);

  // Sync localTime with high frequency for smooth animations
  useEffect(() => {
    let rafId: number;
    const updateTime = () => {
      if (mediaRef.current) {
        setLocalTime(mediaRef.current.currentTime);
      }
      rafId = requestAnimationFrame(updateTime);
    };
    rafId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(rafId);
  }, [mediaRef]);

  // Sync back to parent when paused/seeking
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
    if (!mediaRef.current) return;
    if (mediaRef.current.paused) {
      mediaRef.current.play();
    } else {
      mediaRef.current.pause();
    }
  };

  // Calculate actual video render dimensions inside the object-fit: contain container
  const videoRatio = localVideoDim.width / localVideoDim.height;
  let renderWidth = containerSize.width;
  let renderHeight = containerSize.height;
  
  if (containerSize.height > 0 && containerSize.width > 0) {
    const containerRatio = containerSize.width / containerSize.height;
    if (containerRatio > videoRatio) {
      // Container is wider than video
      renderHeight = containerSize.height;
      renderWidth = renderHeight * videoRatio;
    } else {
      // Container is taller than video
      renderWidth = containerSize.width;
      renderHeight = renderWidth / videoRatio;
    }
  }

  return (
    <div className="h-full rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl flex flex-col">
      <div className="p-3 bg-neutral-900 border-b border-neutral-800 text-sm font-medium text-neutral-400 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-emerald-400" /> Live Preview Studio
        </div>
        <div className="flex items-center gap-2">
          {file && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-neutral-400 hover:text-white"
              onClick={toggleFullScreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          )}
          {status === "burning" ? (
            <Button disabled size="sm" className="bg-blue-600/50 text-white text-xs h-8 flex items-center gap-1.5 font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting...
            </Button>
          ) : (status === "done" && file?.type.startsWith('video') && handleExportVideo) ? (
            <Button onClick={handleExportVideo} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 flex items-center gap-1.5 font-semibold">
              <Download className="w-3.5 h-3.5" /> Export Video
            </Button>
          ) : null}
        </div>
      </div>
      
      <div ref={containerRef} className="bg-black flex-1 flex flex-col relative min-h-[300px]">
        {/* Media Element */}
        <div 
          onClick={handleVideoClick}
          className="flex-1 relative flex items-center justify-center cursor-pointer"
        >
          {file?.type.startsWith('video') ? (
            <video 
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              src={mediaUrl || undefined} 
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
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
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setMediaDuration(e.currentTarget.duration)}
              />
              {/* Audio visual placeholder */}
              <div className="w-32 h-32 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center shadow-2xl">
                <FileAudio className="w-12 h-12 text-neutral-600" />
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
              className={`absolute left-0 right-0 px-8 flex ${
                subtitleStyle.alignment === 'left' ? 'justify-start' : 
                subtitleStyle.alignment === 'right' ? 'justify-end' : 'justify-center'
              }`}
              style={
                subtitleStyle.alignmentVertical === 'top' 
                  ? { top: `${subtitleStyle.positionY ?? 10}%` }
                  : subtitleStyle.alignmentVertical === 'middle'
                  ? { top: '50%', transform: `translateY(calc(-50% + ${subtitleStyle.positionY ?? 0}%))` }
                  : { bottom: `${subtitleStyle.positionY ?? 10}%` }
              }
            >
              {(() => {
                const activeSegment = editableSegments.find((s: any) => localTime >= s.start && localTime < s.end);
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
                  maxWidth: `${subtitleStyle.maxWidth ?? 90}%`,
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
                  combinedShadows.push(`${pxShadowOffsetX}px ${pxShadowOffsetY}px ${pxShadowBlur}px ${subtitleStyle.shadowColor}`);
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

                return activeSegment.words.map((word: any, i: number) => {
                  const isActive = localTime >= word.start && localTime < word.end;
                  const isPast = localTime >= word.end;
                  
                  let wordStyle: React.CSSProperties = {
                    display: 'inline-block',
                    transition: 'all 0.05s ease-out',
                    verticalAlign: subtitleStyle.alignmentVertical === 'top' ? 'top' : subtitleStyle.alignmentVertical === 'middle' ? 'middle' : 'bottom',
                  };

                  if (subtitleStyle.animationStyle === 'reveal' && !isActive && !isPast) {
                    wordStyle.opacity = 0;
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
                        if (subtitleStyle.animationStyle === 'color') {
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
                    <span key={i} style={wordStyle}>
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

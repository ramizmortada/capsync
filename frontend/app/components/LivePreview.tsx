import { useEffect, useRef, useState } from "react";
import { Video, FileAudio } from "lucide-react";

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
}: LivePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [localVideoDim, setLocalVideoDim] = useState({ width: 1920, height: 1080 });

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
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 text-sm font-medium text-neutral-400 flex items-center gap-2 shrink-0">
        <Video className="w-4 h-4 text-emerald-400" /> Live Preview Studio
      </div>
      
      <div ref={containerRef} className="bg-black flex-1 flex flex-col relative min-h-[300px]">
        {/* Media Element */}
        <div className="flex-1 relative flex items-center justify-center">
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
              style={{ bottom: `${subtitleStyle.positionY ?? 10}%` }}
            >
              {(() => {
                const activeSegment = editableSegments.find((s: any) => currentTime >= s.start && currentTime < s.end);
                if (!activeSegment) return null;
                
                const hexToRgba = (hex: string, opacity: number) => {
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
                };

                // Compute exact pixels from percentages of renderHeight
                const pxFontSize = (subtitleStyle.fontSize / 100) * renderHeight;
                const pxStrokeWidth = (subtitleStyle.strokeWidth / 100) * renderHeight;
                const pxShadowBlur = (subtitleStyle.shadowBlur / 100) * renderHeight;
                const pxShadowOffsetX = (subtitleStyle.shadowOffsetX / 100) * renderHeight;
                const pxShadowOffsetY = (subtitleStyle.shadowOffsetY / 100) * renderHeight;
                
                // Box padding uses 0.5% v-padding, 1% h-padding
                const pxPadY = (0.5 / 100) * renderHeight;
                const pxPadX = (1.0 / 100) * renderHeight;
                const pxRadius = pxPadX;
                
                // Box highlight padding
                const pxHighlightPad = (0.6 / 100) * renderHeight;

                const wrapperStyle: React.CSSProperties = {
                  backgroundColor: subtitleStyle.backgroundEnabled ? hexToRgba(subtitleStyle.backgroundColor, subtitleStyle.backgroundOpacity) : 'transparent',
                  padding: subtitleStyle.backgroundEnabled ? `${pxPadY}px ${pxPadX}px` : '0',
                  borderRadius: subtitleStyle.backgroundEnabled ? `${pxRadius}px` : '0',
                  display: 'inline-block',
                  maxWidth: '100%',
                };

                const textContainerStyle: React.CSSProperties = {
                  fontFamily: subtitleStyle.fontFamily,
                  fontWeight: subtitleStyle.fontWeight,
                  fontSize: `${pxFontSize}px`,
                  textAlign: subtitleStyle.alignment || 'center',
                  lineHeight: '1.2',
                  position: 'relative',
                  display: 'inline-block',
                };

                // The stroke layer (drawn double thick, under the text)
                const strokeLayerStyle: React.CSSProperties = {
                  position: 'absolute',
                  left: 0, top: 0, right: 0, bottom: 0,
                  color: subtitleStyle.textColor,
                  WebkitTextStroke: subtitleStyle.strokeEnabled ? `${pxStrokeWidth * 2}px ${subtitleStyle.strokeColor}` : undefined,
                  WebkitTextFillColor: subtitleStyle.textColor,
                  textShadow: subtitleStyle.shadowEnabled 
                    ? `${pxShadowOffsetX}px ${pxShadowOffsetY}px ${pxShadowBlur}px ${subtitleStyle.shadowColor}`
                    : undefined,
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
                  const isActive = currentTime >= word.start && currentTime < word.end;
                  const isPast = currentTime >= word.end;
                  
                  let wordStyle: React.CSSProperties = {
                    display: 'inline-block',
                    transition: 'all 0.1s ease-out',
                  };

                  if (subtitleStyle.animationStyle !== 'none') {
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
                <div style={wrapperStyle} className="transition-all duration-75">
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

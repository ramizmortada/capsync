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
}: LivePreviewProps) {
  return (
    <div className="h-full rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl flex flex-col">
      <div className="p-4 bg-neutral-900 border-b border-neutral-800 text-sm font-medium text-neutral-400 flex items-center gap-2 shrink-0">
        <Video className="w-4 h-4 text-emerald-400" /> Live Preview Studio
      </div>
      
      <div className="bg-black flex-1 flex flex-col relative min-h-[300px]">
        {/* Media Element */}
        <div className="flex-1 relative flex items-center justify-center">
          {file?.type.startsWith('video') ? (
            <video 
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              src={mediaUrl || undefined} 
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setMediaDuration(e.currentTarget.duration)}
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

          {/* Subtitle Overlay (Inside Video) */}
          <div className="absolute bottom-12 left-0 right-0 px-8 flex justify-center pointer-events-none">
            {(() => {
              const activeSegment = editableSegments.find((s: any) => currentTime >= s.start && currentTime <= s.end);
              if (!activeSegment) return null;
              
              const hexToRgba = (hex: string, opacity: number) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
              };

              const wrapperStyle: React.CSSProperties = {
                backgroundColor: subtitleStyle.backgroundEnabled ? hexToRgba(subtitleStyle.backgroundColor, subtitleStyle.backgroundOpacity) : 'transparent',
                padding: subtitleStyle.backgroundEnabled ? '8px 16px' : '0',
                borderRadius: subtitleStyle.backgroundEnabled ? '8px' : '0',
                display: 'inline-block',
                maxWidth: '100%',
              };

              const textContainerStyle: React.CSSProperties = {
                fontFamily: subtitleStyle.fontFamily,
                fontWeight: subtitleStyle.fontWeight,
                fontSize: `${subtitleStyle.fontSize}px`,
                textAlign: 'center',
                lineHeight: '1.2',
                position: 'relative',
                display: 'inline-block',
              };

              // The stroke layer (drawn double thick, under the text)
              const strokeLayerStyle: React.CSSProperties = {
                position: 'absolute',
                left: 0, top: 0, right: 0, bottom: 0,
                color: subtitleStyle.textColor,
                WebkitTextStroke: subtitleStyle.strokeEnabled ? `${subtitleStyle.strokeWidth * 2}px ${subtitleStyle.strokeColor}` : undefined,
                WebkitTextFillColor: subtitleStyle.textColor,
                textShadow: subtitleStyle.shadowEnabled 
                  ? `${subtitleStyle.shadowOffsetX}px ${subtitleStyle.shadowOffsetY}px ${subtitleStyle.shadowBlur}px ${subtitleStyle.shadowColor}`
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

              return (
                <div style={wrapperStyle} className="transition-all duration-75">
                  <div style={textContainerStyle} className="whitespace-pre-wrap">
                    <div style={strokeLayerStyle} aria-hidden="true">
                      {activeSegment.text.trim()}
                    </div>
                    <div style={fillLayerStyle}>
                      {activeSegment.text.trim()}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

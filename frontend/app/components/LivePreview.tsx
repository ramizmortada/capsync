import { Video, FileAudio } from "lucide-react";

interface LivePreviewProps {
  file: File | null;
  mediaUrl: string;
  mediaRef: React.RefObject<HTMLMediaElement>;
  setCurrentTime: (time: number) => void;
  setMediaDuration: (duration: number) => void;
  editableSegments: any[];
  currentTime: number;
}

export function LivePreview({
  file,
  mediaUrl,
  mediaRef,
  setCurrentTime,
  setMediaDuration,
  editableSegments,
  currentTime,
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
              
              return (
                <span className="font-bold text-2xl md:text-3xl text-white tracking-wide bg-black/60 px-4 py-1.5 rounded text-center backdrop-blur-sm shadow-lg leading-tight max-w-[90%]">
                  {activeSegment.text}
                </span>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

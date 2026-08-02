"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { del } from "idb-keyval";
import { SettingsPanel } from "../components/SettingsPanel";
import { SubtitleEditor } from "../components/SubtitleEditor";
import { LivePreview } from "../components/LivePreview";
import { InteractiveTimeline } from "../components/InteractiveTimeline";

import { formatSrtTime } from "@/lib/utils";
import { SubtitleStyle, StylePreset, DragTarget, DEFAULT_PRESETS } from "../types";
import { usePresets } from "../../hooks/usePresets";
import { useTranscription } from "../../hooks/useTranscription";
import { useSubtitleState } from "../../hooks/useSubtitleState";
import { useTimelineDragging } from "../../hooks/useTimelineDragging";
import { useCutZones } from "../../hooks/useCutZones";
import { usePlaybackSync } from "../../hooks/usePlaybackSync";
import { useProjectPersistence } from "../../hooks/useProjectPersistence";

export type { SubtitleStyle, StylePreset, DragTarget };
export { DEFAULT_PRESETS };

export default function WhisperXApp() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  
  // States
  const [modelSize, setModelSize] = useState("tiny");
  const [language, setLanguage] = useState("");
  const [maxWords, setMaxWords] = useState("-1");
  const [status, setStatus] = useState<"idle" | "uploading" | "downloading_model" | "transcribing" | "burning" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadedModels, setDownloadedModels] = useState<Record<string, boolean>>({});

  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>({
    fontFamily: "Inter",
    fontWeight: "500",
    fontSize: 50,
    textColor: "#ffffff",
    strokeEnabled: true,
    strokeColor: "#000000",
    strokeWidth: 2,
    shadowEnabled: false,
    shadowColor: "#000000",
    shadowOffsetX: 0,
    shadowOffsetY: 8,
    shadowBlur: 10,
    shadow3DEnabled: false,
    backgroundEnabled: false,
    backgroundColor: "#000000",
    backgroundOpacity: 50,
    highlightColor: "#ffff00",
    alignment: 'center',
    alignmentVertical: 'top',
    positionY: 70,
    animationStyle: 'none',
    animationIn: 'none',
    animationOut: 'none',
    highlightBackgroundColor: "#ff0000",
    scaleFactor: 1.2,
    maxWidth: 100,
    textTransform: 'none',
  });

  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [masterTime, setMasterTime] = useState(0);
  const masterTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const [mediaDuration, setMediaDuration] = useState<number>(0);
  const [videoDimensions, setVideoDimensions] = useState<{width: number, height: number}>({width: 1920, height: 1080});
  const [draggingBoundary, setDraggingBoundary] = useState<DragTarget | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [silenceThreshold, setSilenceThreshold] = useState<number>(1.0);
  const [safePadding, setSafePadding] = useState<number>(150);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLMediaElement>(null);
  const isHoveringTimeline = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);

  // Subtitle management hook
  const subtitleState = useSubtitleState({
    file,
    status,
    result,
    setResult,
    silenceThreshold,
  });

  const {
    editableSegments,
    setEditableSegments,
    selectedIndexes,
    setSelectedIndexes,
    rippleDeletes,
    setRippleDeletes,
    setSegmentHistory,
    handleSegmentChange,
    handleToggleWordDelete,
    handleToggleSegmentSilence,
    handleAutoCutSilences,
    handleMergeSegments,
    handleDeleteSegments,
    handleLiftDelete,
    handleRippleDelete,
    handleRippleDeleteRange,
    handleDuplicateSegment,
    handleOffsetSegments,
    handleResegment,
    videoSegments,
    setVideoSegments,
    selectedVideoIndexes,
    setSelectedVideoIndexes,
    cursorMode,
    setCursorMode,
    handleVideoCut,
    handleVideoDelete,
    handleVideoRippleDelete,
  } = subtitleState;

  const [videoCanvas, setVideoCanvas] = useState<any>({ type: 'auto' });

  // Preset management hook
  const {
    presets,
    activePresetId,
    handleModelSizeChange,
    handleMaxWordsChange,
    handleSubtitleStyleChange,
    savePreset,
    deletePreset,
    applyPreset,
    updatePreset,
  } = usePresets(
    subtitleStyle,
    setSubtitleStyle,
    modelSize,
    setModelSize,
    maxWords,
    setMaxWords
  );

  // Fetch downloaded models status
  const checkModelsStatus = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/models/status");
      if (res.ok) {
        const data = await res.json();
        setDownloadedModels(data);
      }
    } catch (err) {
      console.log("Could not fetch models status");
    }
  };

  const cutZones = useCutZones(editableSegments, rippleDeletes, videoSegments, safePadding);

  // Transcription hook
  const {
    transcriptionMessage,
    handleTranscribe,
    cancelTranscription,
    handleExportVideo,
  } = useTranscription({
    file,
    status,
    setStatus,
    setProgress,
    setResult,
    setErrorMessage,
    editableSegments,
    setEditableSegments,
    subtitleStyle,
    videoDimensions,
    cutZones,
    setSegmentHistory,
    setRippleDeletes,
    checkModelsStatus,
    downloadedModels,
    modelSize,
    maxWords,
    language,
    videoCanvas,
    videoSegments,
  });

  // Timeline dragging hook
  useTimelineDragging({
    draggingBoundary,
    setDraggingBoundary,
    trackRef,
    mediaDuration,
    rippleDeletes,
    editableSegments,
    setEditableSegments,
    setSegmentHistory,
  });

  useProjectPersistence({
    file,
    setFile,
    status,
    setStatus,
    result,
    setResult,
    editableSegments,
    setEditableSegments,
    rippleDeletes,
    setRippleDeletes,
    videoSegments,
    setVideoSegments,
    videoCanvas,
    setVideoCanvas,
    subtitleStyle,
    setSubtitleStyle,
    setModelSize,
    setLanguage,
    setMaxWords,
    mediaRef,
  });

  const { getValidSeekTime } = usePlaybackSync({
    mediaRef,
    timelineRef,
    trackRef,
    mediaDuration,
    videoSegments,
    rippleDeletes,
    editableSegments,
    masterTimeRef,
    setMasterTime,
    masterTime,
    isPlayingRef,
    isHoveringTimeline,
    draggingBoundary,
    zoomLevel,
  });

  // Generate local object URL for instant media playback
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setMediaUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setMediaUrl("");
    }
  }, [file]);

  useEffect(() => {
    checkModelsStatus();
  }, []);

  // Initialize video segments when media duration is known
  useEffect(() => {
    if (mediaDuration > 0 && videoSegments.length === 0) {
      setVideoSegments([{
        id: Math.random().toString(36).substr(2, 9),
        sourceStart: 0,
        sourceEnd: mediaDuration,
        timelineStart: 0,
        timelineEnd: mediaDuration,
        deleted: false
      }]);
    }
  }, [mediaDuration, videoSegments.length, setVideoSegments]);

  // Poll progress and status
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        if (status === "downloading_model") {
          const res = await fetch(`http://127.0.0.1:8000/api/models/progress/${modelSize}`);
          if (res.ok) {
            const data = await res.json();
            setProgress(data.progress);
            if (data.status === "done") {
              setStatus("transcribing");
            }
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    if (status === "downloading_model" || status === "transcribing") {
      interval = setInterval(pollStatus, 500);
    }
    
    return () => clearInterval(interval);
  }, [status, modelSize]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const togglePlay = () => {
    if (mediaRef.current) {
      if (mediaRef.current.paused) {
        if (masterTime >= mediaDuration - 0.1) {
          const validTime = getValidSeekTime(0);
          mediaRef.current.currentTime = validTime;
          masterTimeRef.current = validTime;
          setMasterTime(validTime);
        }
        mediaRef.current.play().catch(e => {
          if (e.name !== 'AbortError') console.error(e);
        });
        setIsPlaying(true);
        isPlayingRef.current = true;
      } else {
        mediaRef.current.pause();
        setIsPlaying(false);
        isPlayingRef.current = false;
      }
    }
  };

  const stopPlay = () => {
    if (mediaRef.current) {
      mediaRef.current.pause();
      const validTime = getValidSeekTime(0);
      mediaRef.current.currentTime = validTime;
      masterTimeRef.current = validTime;
      setMasterTime(validTime);
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  };

  // Listen to media element events to sync state (mostly for external pauses)
  useEffect(() => {
    const video = mediaRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      isPlayingRef.current = true;
    };
    const handlePause = () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'Backspace' || e.code === 'Delete') {
        e.preventDefault();
        e.stopPropagation();
        
        if (selectedIndexes.length > 0) {
          setSegmentHistory({
            past: [{
              segments: JSON.parse(JSON.stringify(editableSegments)),
              rippleDeletes: JSON.parse(JSON.stringify(rippleDeletes)),
              videoSegments: JSON.parse(JSON.stringify(videoSegments))
            }],
            future: []
          });
          const hasShift = e.shiftKey;
          setEditableSegments(prev => prev.map((seg, sIdx) => {
            const newSeg = { ...seg, words: seg.words.map((w: any) => ({ ...w })) };
            newSeg.words.forEach((w: any, wIdx: number) => {
              if (selectedIndexes.includes(`word:${sIdx}:${wIdx}`)) {
                w.deleted = true;
              }
            });
            return newSeg;
          }));
          
          if (hasShift) {
            handleRippleDelete(selectedIndexes);
          }
        }
        
        if (selectedVideoIndexes.length > 0) {
          if (e.shiftKey) {
            handleVideoRippleDelete(selectedVideoIndexes);
          } else {
            handleVideoDelete(selectedVideoIndexes);
          }
        }
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        setCursorMode('cut');
      } else if (e.code === 'KeyV') {
        e.preventDefault();
        setCursorMode('select');
      } else if (e.code === 'KeyD') {
        e.preventDefault();
        e.stopPropagation();
        
        if (selectedIndexes.length > 0) {
          setSegmentHistory({
            past: [{
              segments: JSON.parse(JSON.stringify(editableSegments)),
              rippleDeletes: JSON.parse(JSON.stringify(rippleDeletes)),
              videoSegments: JSON.parse(JSON.stringify(videoSegments))
            }],
            future: []
          });
          setEditableSegments(prev => prev.map((seg, sIdx) => {
            const newSeg = { ...seg, words: seg.words.map((w: any) => ({ ...w })) };
            newSeg.words.forEach((w: any, wIdx: number) => {
              if (selectedIndexes.includes(`word:${sIdx}:${wIdx}`)) {
                w.deleted = true;
              }
            });
            return newSeg;
          }));
        }
        
        if (selectedVideoIndexes.length > 0) {
          handleVideoDelete(selectedVideoIndexes);
        }
      } else if (e.code === 'KeyX') {
        e.preventDefault();
        e.stopPropagation();
        
        if (selectedIndexes.length > 0) {
          setSegmentHistory({
            past: [{
              segments: JSON.parse(JSON.stringify(editableSegments)),
              rippleDeletes: JSON.parse(JSON.stringify(rippleDeletes)),
              videoSegments: JSON.parse(JSON.stringify(videoSegments))
            }],
            future: []
          });
          setEditableSegments(prev => prev.map((seg, sIdx) => {
            const newSeg = { ...seg, words: seg.words.map((w: any) => ({ ...w })) };
            newSeg.words.forEach((w: any, wIdx: number) => {
              if (selectedIndexes.includes(`word:${sIdx}:${wIdx}`)) {
                w.deleted = true;
              }
            });
            return newSeg;
          }));
          handleRippleDelete(selectedIndexes);
        }
        
        if (selectedVideoIndexes.length > 0) {
          handleVideoRippleDelete(selectedVideoIndexes);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [editableSegments, togglePlay, setEditableSegments, setRippleDeletes, setSegmentHistory, rippleDeletes, setCursorMode, selectedVideoIndexes, handleVideoDelete, handleVideoRippleDelete, setSelectedVideoIndexes, videoSegments, setVideoSegments, selectedIndexes, handleRippleDelete]);

  // Convert WhisperX segments to SRT format
  const generateSRT = () => {
    if (!editableSegments || editableSegments.length === 0) return "";
    
    let srtContent = "";
    editableSegments.forEach((segment: any, index: number) => {
      srtContent += `${index + 1}\n`;
      srtContent += `${formatSrtTime(segment.start)} --> ${formatSrtTime(segment.end)}\n`;
      srtContent += `${segment.text.trim()}\n\n`;
    });
    
    return srtContent;
  };

  const clearProject = async () => {
    await del('capsync_project');
    setFile(null);
    setStatus("idle");
    setResult(null);
    setEditableSegments([]);
    setSegmentHistory({ past: [], future: [] });
    setRippleDeletes([]);
    setMediaUrl("");
  };

  const downloadSRT = () => {
    const srtContent = generateSRT();
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name.split('.')[0] || 'transcript'}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-neutral-950 text-neutral-50 font-sans selection:bg-blue-500/30 h-screen flex flex-col overflow-hidden p-4">
      <div className="mx-auto w-full transition-all duration-500 ease-in-out flex flex-col flex-1 overflow-hidden max-w-[100rem]">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden mb-4">
          <div className="lg:col-span-3 flex flex-col h-full overflow-hidden">
            <SettingsPanel 
              file={file}
              setFile={setFile}
              status={status}
              progress={progress}
              modelSize={modelSize}
              setModelSize={handleModelSizeChange}
              language={language}
              setLanguage={setLanguage}
              maxWords={maxWords}
              setMaxWords={handleMaxWordsChange}
              handleFileChange={handleFileChange}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              fileInputRef={fileInputRef}
              handleTranscribe={handleTranscribe}
              downloadedModels={downloadedModels}
              cancelTranscription={cancelTranscription}
              handleResegment={() => handleResegment(maxWords)}
              result={result}
              transcriptionMessage={transcriptionMessage}
              clearProject={clearProject}
              subtitleStyle={subtitleStyle}
              setSubtitleStyle={handleSubtitleStyleChange}
              handleExportVideo={handleExportVideo}
              presets={presets}
              activePresetId={activePresetId}
              onSavePreset={savePreset}
              onDeletePreset={deletePreset}
              onApplyPreset={applyPreset}
              onUpdatePreset={updatePreset}
              onGoToGrid={() => router.push('/clips')}
            />
          </div>

          <div className="lg:col-span-4 animate-in fade-in slide-in-from-bottom-4 duration-700 h-full overflow-hidden">
            <SubtitleEditor 
              editableSegments={editableSegments}
              selectedIndexes={selectedIndexes.filter(i => typeof i === 'number') as number[]}
              setSelectedIndexes={setSelectedIndexes}
              rippleDeletes={rippleDeletes}
              handleMergeSegments={handleMergeSegments}
              handleLiftDelete={handleLiftDelete}
              handleRippleDelete={handleRippleDelete}
              silenceThreshold={silenceThreshold}
              setSilenceThreshold={setSilenceThreshold}
              safePadding={safePadding}
              setSafePadding={setSafePadding}
              handleAutoCutSilences={handleAutoCutSilences}
              currentTime={masterTime}
              handleSegmentChange={handleSegmentChange}
              handleToggleSegmentSilence={handleToggleSegmentSilence}
              handleDeleteSegments={handleDeleteSegments}
              handleDuplicateSegment={handleDuplicateSegment}
              handleOffsetSegments={handleOffsetSegments}
              onSeek={(mediaTime) => {
                const validTime = getValidSeekTime(mediaTime);
                if (mediaRef.current) {
                  mediaRef.current.currentTime = validTime;
                }
                masterTimeRef.current = validTime;
                setMasterTime(validTime);
              }}
              clearProject={clearProject}
              downloadSRT={downloadSRT}
              videoCanvas={videoCanvas}
              setVideoCanvas={setVideoCanvas}
              videoSegments={videoSegments}
              setVideoSegments={setVideoSegments}
              selectedVideoIndexes={selectedVideoIndexes}
            />
          </div>

          <div className="lg:col-span-5 animate-in fade-in slide-in-from-right-8 duration-700 h-full overflow-hidden">
            <LivePreview 
              file={file}
              mediaUrl={mediaUrl}
              mediaRef={mediaRef}
              currentTime={masterTime}
              setCurrentTime={(time) => {
                masterTimeRef.current = time;
                setMasterTime(time);
                const activeClip = videoSegments.find(s => !s.deleted && time >= s.timelineStart && time < s.timelineEnd);
                if (activeClip && mediaRef.current) {
                  mediaRef.current.currentTime = activeClip.sourceStart + (time - activeClip.timelineStart);
                }
              }}
              setMediaDuration={setMediaDuration}
              setVideoDimensions={setVideoDimensions}
              editableSegments={editableSegments}
              videoSegments={videoSegments}
              cutZones={cutZones}
              subtitleStyle={subtitleStyle}
              handleExportVideo={handleExportVideo}
              status={status}
              togglePlay={togglePlay}
              videoCanvas={videoCanvas}
              setVideoSegments={setVideoSegments}
            />
          </div>
        </div>

        <div className="shrink-0 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <InteractiveTimeline 
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            stopPlay={stopPlay}
            currentTime={masterTime}
            mediaDuration={mediaDuration}
            file={file}
            zoomLevel={zoomLevel}
            setZoomLevel={setZoomLevel}
            timelineRef={timelineRef}
            isHoveringTimeline={isHoveringTimeline}
            trackRef={trackRef}
            editableSegments={editableSegments}
            selectedIndexes={selectedIndexes}
            setSelectedIndexes={setSelectedIndexes}
            handleLiftDelete={handleLiftDelete}
            handleRippleDelete={handleRippleDelete}
            handleRippleDeleteRange={handleRippleDeleteRange}
            rippleDeletes={rippleDeletes}
            cutZones={cutZones}
            setDraggingBoundary={setDraggingBoundary}
            draggingBoundary={draggingBoundary}
            handleToggleWordDelete={handleToggleWordDelete}
            onSeek={(mediaTime) => {
              const validTime = getValidSeekTime(mediaTime);
              if (mediaRef.current) {
                mediaRef.current.currentTime = validTime;
              }
              masterTimeRef.current = validTime;
              setMasterTime(validTime);
            }}
            videoSegments={videoSegments}
            setVideoSegments={setVideoSegments}
            selectedVideoIndexes={selectedVideoIndexes}
            setSelectedVideoIndexes={setSelectedVideoIndexes}
            cursorMode={cursorMode}
            handleVideoCut={handleVideoCut}
            setEditableSegments={setEditableSegments}
            setSegmentHistory={setSegmentHistory}
          />
        </div>
      </div>
    </div>
  );
}

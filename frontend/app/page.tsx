"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { get, set, del } from "idb-keyval";
import { SettingsPanel } from "./components/SettingsPanel";
import { SubtitleEditor } from "./components/SubtitleEditor";
import { LivePreview } from "./components/LivePreview";
import { InteractiveTimeline } from "./components/InteractiveTimeline";

import { formatSrtTime, injectPauseChips } from "@/lib/utils";
import { SubtitleStyle, StylePreset, DragTarget, DEFAULT_PRESETS } from "./types";
import { usePresets } from "../hooks/usePresets";
import { useTranscription } from "../hooks/useTranscription";
import { useSubtitleState } from "../hooks/useSubtitleState";
import { useTimelineDragging } from "../hooks/useTimelineDragging";

export type { SubtitleStyle, StylePreset, DragTarget };
export { DEFAULT_PRESETS };

export default function WhisperXApp() {
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
  const [currentTime, setCurrentTime] = useState(0);
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

  const [isProjectLoaded, setIsProjectLoaded] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
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
    handleDuplicateSegment,
    handleOffsetSegments,
    handleResegment,
  } = subtitleState;

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
      const res = await fetch("http://localhost:8000/api/models/status");
      if (res.ok) {
        const data = await res.json();
        setDownloadedModels(data);
      }
    } catch (err) {
      console.log("Could not fetch models status");
    }
  };

  const cutZones = useMemo(() => {
    let rawIntervals: { start: number; end: number; isSegmentStart: boolean; isSegmentEnd: boolean }[] = [];
    
    editableSegments.forEach((seg) => {
      if (!seg.words || seg.words.length === 0) return;
      
      const realWords = seg.words.filter((w: any) => !w.isGap);
      const isFullyDeleted = realWords.length > 0 && realWords.every((w: any) => w.deleted);
      
      if (isFullyDeleted) {
        rawIntervals.push({
          start: seg.start,
          end: seg.end,
          isSegmentStart: true,
          isSegmentEnd: true
        });
      } else {
        seg.words.forEach((w: any) => {
          if (w.deleted) {
            rawIntervals.push({
              start: w.start,
              end: w.end,
              isSegmentStart: false,
              isSegmentEnd: false
            });
          }
        });
      }
    });

    rippleDeletes.forEach(zone => {
      rawIntervals.push({
        start: zone.start,
        end: zone.end,
        isSegmentStart: true,
        isSegmentEnd: true
      });
    });

    if (rawIntervals.length === 0) return [];

    rawIntervals.sort((a, b) => a.start - b.start);

    let merged: typeof rawIntervals = [];
    let current = { ...rawIntervals[0] };

    for (let i = 1; i < rawIntervals.length; i++) {
      const next = rawIntervals[i];
      if (next.start <= current.end + 0.05) {
        current.end = Math.max(current.end, next.end);
        current.isSegmentEnd = current.isSegmentEnd || next.isSegmentEnd;
        current.isSegmentStart = current.isSegmentStart || next.isSegmentStart;
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);

    const pad = safePadding / 1000;
    const finalZones: { start: number; end: number }[] = [];

    merged.forEach((zone) => {
      const cutStart = zone.isSegmentStart ? zone.start : zone.start + pad;
      const cutEnd = zone.isSegmentEnd ? zone.end : zone.end - pad;

      if (cutEnd - cutStart > 0.02) {
        finalZones.push({ start: cutStart, end: cutEnd });
      }
    });

    return finalZones;
  }, [editableSegments, safePadding, rippleDeletes]);

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

  // Load project from IndexedDB
  useEffect(() => {
    async function loadProject() {
      try {
        const savedProject = await get('capsync_project');
        if (savedProject) {
          if (savedProject.file) setFile(savedProject.file);
          if (savedProject.status) setStatus(savedProject.status);
          if (savedProject.result) setResult(savedProject.result);
          if (savedProject.editableSegments) setEditableSegments(injectPauseChips(savedProject.editableSegments));
        }
      } catch (err) {
        console.error("Failed to load project from IDB", err);
      } finally {
        setIsProjectLoaded(true);
      }
    }
    loadProject();
  }, [setEditableSegments]);

  // Load subtitle style from localStorage
  useEffect(() => {
    const savedStyle = localStorage.getItem("capsync_subtitle_style");
    if (savedStyle) {
      try {
        const parsed = JSON.parse(savedStyle);
        setSubtitleStyle(prev => ({ ...prev, ...parsed }));
      } catch (err) {
        console.error("Failed to load subtitle style from localStorage", err);
      }
    }
    setIsStyleLoaded(true);
  }, []);

  // Save project to IndexedDB
  useEffect(() => {
    if (isProjectLoaded) {
      if (file === null && status === 'idle') {
        del('capsync_project').catch(console.error);
      } else {
        set('capsync_project', { file, status, result, editableSegments }).catch(console.error);
      }
    }
  }, [isProjectLoaded, file, status, result, editableSegments]);

  // Save subtitle style to localStorage
  useEffect(() => {
    if (isStyleLoaded) {
      localStorage.setItem("capsync_subtitle_style", JSON.stringify(subtitleStyle));
    }
  }, [isStyleLoaded, subtitleStyle]);

  // Load settings from local storage
  useEffect(() => {
    const savedModel = localStorage.getItem("whisperx_model");
    const savedLang = localStorage.getItem("whisperx_lang");
    const savedWords = localStorage.getItem("whisperx_words");
    
    if (savedModel) setModelSize(savedModel);
    if (savedLang !== null) setLanguage(savedLang);
    if (savedWords) setMaxWords(savedWords);
  }, []);

  // Save settings to local storage
  useEffect(() => {
    localStorage.setItem("whisperx_model", modelSize);
    localStorage.setItem("whisperx_lang", language);
    localStorage.setItem("whisperx_words", maxWords);
  }, [modelSize, language, maxWords]);

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
    if (!mediaRef.current) return;
    if (mediaRef.current.paused) {
      mediaRef.current.play().catch((err) => {
        if (err.name !== 'AbortError') {
          console.error("Playback error:", err);
        }
      });
    } else {
      mediaRef.current.pause();
    }
  };

  const stopPlay = () => {
    if (!mediaRef.current) return;
    mediaRef.current.pause();
    mediaRef.current.currentTime = 0;
  };

  // Keyboard shortcuts effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        togglePlay();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !isInput) {
        e.preventDefault();
        if (e.shiftKey) {
          // Redo
          setSegmentHistory((prev: any) => {
            if (prev.future.length === 0) return prev;
            const nextState = prev.future[0];
            setEditableSegments(nextState.segments);
            setRippleDeletes(nextState.rippleDeletes);
            return {
              past: [...prev.past, { segments: editableSegments, rippleDeletes: [...rippleDeletes] }],
              future: prev.future.slice(1)
            };
          });
        } else {
          // Undo
          setSegmentHistory((prev: any) => {
            if (prev.past.length === 0) return prev;
            const prevState = prev.past[prev.past.length - 1];
            setEditableSegments(prevState.segments);
            setRippleDeletes(prevState.rippleDeletes);
            return {
              past: prev.past.slice(0, -1),
              future: [{ segments: editableSegments, rippleDeletes: [...rippleDeletes] }, ...prev.future]
            };
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [editableSegments, togglePlay, setEditableSegments, setRippleDeletes, setSegmentHistory, rippleDeletes]);

  // Center timeline on playhead
  useEffect(() => {
    if (timelineRef.current && trackRef.current && mediaRef.current && mediaDuration > 0) {
      const trackWidth = trackRef.current.scrollWidth;
      const playheadX = (mediaRef.current.currentTime / mediaDuration) * trackWidth;
      const container = timelineRef.current;
      container.scrollLeft = playheadX - container.clientWidth / 2;
    }
  }, [zoomLevel, mediaDuration]);

  // Smooth Auto-scroll timeline when playing
  useEffect(() => {
    let animationFrameId: number;

    const smoothSync = () => {
      if (!mediaRef.current || mediaDuration <= 0) return;

      if (timelineRef.current && trackRef.current && !isHoveringTimeline.current && draggingBoundary === null) {
        const trackWidth = trackRef.current.scrollWidth;
        const playheadX = (mediaRef.current.currentTime / mediaDuration) * trackWidth;
        const container = timelineRef.current;
        const clientWidth = container.clientWidth;
        container.scrollLeft = playheadX - clientWidth / 2;
      }

      if (!mediaRef.current.paused) {
        animationFrameId = requestAnimationFrame(smoothSync);
      }
    };

    const videoEl = mediaRef.current;
    if (!videoEl) return;

    const onPlay = () => {
      setIsPlaying(true);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(smoothSync);
    };

    const onPause = () => {
      setIsPlaying(false);
    };

    videoEl.addEventListener('play', onPlay);
    videoEl.addEventListener('playing', onPlay);
    videoEl.addEventListener('pause', onPause);
    videoEl.addEventListener('seeked', () => {
      if (!videoEl.paused) onPlay();
    });

    if (!videoEl.paused) {
      onPlay();
    }

    return () => {
      videoEl.removeEventListener('play', onPlay);
      videoEl.removeEventListener('playing', onPlay);
      videoEl.removeEventListener('pause', onPause);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [mediaDuration, draggingBoundary]);

  // Auto-scroll subtitle editor list
  useEffect(() => {
    if (!mediaRef.current || mediaRef.current.paused || mediaDuration <= 0) return;

    const activeIndex = editableSegments.findIndex((s: any) => currentTime >= s.start && currentTime < s.end);
    if (activeIndex !== -1) {
      const activeElement = document.getElementById(`subtitle-segment-${activeIndex}`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTime, mediaDuration, editableSegments]);

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
              currentTime={currentTime}
              handleSegmentChange={handleSegmentChange}
              handleToggleWordDelete={handleToggleWordDelete}
              handleToggleSegmentSilence={handleToggleSegmentSilence}
              handleDeleteSegments={handleDeleteSegments}
              handleDuplicateSegment={handleDuplicateSegment}
              handleOffsetSegments={handleOffsetSegments}
              onSeek={(time) => {
                if (mediaRef.current) {
                  mediaRef.current.currentTime = time;
                }
              }}
              clearProject={clearProject}
              downloadSRT={downloadSRT}
            />
          </div>

          <div className="lg:col-span-5 animate-in fade-in slide-in-from-right-8 duration-700 h-full overflow-hidden">
            <LivePreview 
              file={file}
              mediaUrl={mediaUrl}
              mediaRef={mediaRef}
              setCurrentTime={setCurrentTime}
              setMediaDuration={setMediaDuration}
              setVideoDimensions={setVideoDimensions}
              editableSegments={editableSegments}
              cutZones={cutZones}
              currentTime={currentTime}
              subtitleStyle={subtitleStyle}
              handleExportVideo={handleExportVideo}
              status={status}
            />
          </div>
        </div>

        <div className="shrink-0 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <InteractiveTimeline 
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            stopPlay={stopPlay}
            currentTime={currentTime}
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
            rippleDeletes={rippleDeletes}
            cutZones={cutZones}
            setDraggingBoundary={setDraggingBoundary}
            draggingBoundary={draggingBoundary}
            handleToggleWordDelete={handleToggleWordDelete}
            onSeek={(time) => {
              if (mediaRef.current) {
                mediaRef.current.currentTime = time;
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

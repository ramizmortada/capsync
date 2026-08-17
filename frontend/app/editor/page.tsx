"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { del } from "idb-keyval";
import { ArrowLeft, Edit2, Check, Film, Folder, Copy, Trash2, Download, Video, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
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
import { renameTimeline, getTimeline, getAllProjects, duplicateTimeline, deleteTimeline, getAllTimelines } from "@/lib/timelineStorage";

export type { SubtitleStyle, StylePreset, DragTarget };
export { DEFAULT_PRESETS };

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timelineId = searchParams.get('id');

  const [file, setFile] = useState<File | null>(null);
  const [timelineName, setTimelineName] = useState<string>("Timeline");
  const [projectName, setProjectName] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isCopiedTitle, setIsCopiedTitle] = useState(false);

  useEffect(() => {
    async function loadProjectInfo() {
      if (timelineId) {
        const t = await getTimeline(timelineId);
        if (t && t.projectId) {
          const projects = await getAllProjects();
          const p = projects.find(proj => proj.id === t.projectId);
          if (p) setProjectName(p.name);
        }
      }
    }
    loadProjectInfo();
  }, [timelineId]);
  
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
    maxWidth: 90,
    marginLeft: 5,
    marginRight: 5,
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const isHoveringTimeline = useRef(false);
  const hasInitializedVideoRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);

  const isBusy = status === 'uploading' || status === 'downloading_model' || status === 'transcribing' || status === 'burning';

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isBusy) {
        e.preventDefault();
        e.returnValue = 'Transcription is currently in progress. Are you sure you want to leave?';
        return 'Transcription is currently in progress. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isBusy]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__capsync_is_transcribing = isBusy;
      window.dispatchEvent(new Event('capsync_transcription_status_change'));
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__capsync_is_transcribing = false;
        window.dispatchEvent(new Event('capsync_transcription_status_change'));
      }
    };
  }, [isBusy]);

  const handleSafeNavigate = (url: string) => {
    if (isBusy) {
      alert(`Transcription is currently in progress (${progress}%). Please wait for transcription to complete before navigating away.`);
      return;
    }
    router.push(url);
  };

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
    audioSegments,
    setAudioSegments,
    selectedAudioIndexes,
    setSelectedAudioIndexes,
    isAudioLinked,
    setIsAudioLinked,
    cursorMode,
    setCursorMode,
    handleSubtitleCutAtTime,
    handleVideoCut,
    handleAudioCut,
    applyJCut,
    applyLCut,
    handleVideoDelete,
    handleAudioDelete,
    handleVideoRippleDelete,
    handleAudioRippleDelete,
    undo,
    redo,
    handleClearTrack,
  } = subtitleState;

  const handleGenerateAiTitle = async () => {
    const fullText = (editableSegments || [])
      .map((s: any) => s.text)
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!fullText) return;

    setIsGeneratingTitle(true);
    try {
      const res = await fetch("/api/ai/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: fullText }),
      });
      const data = await res.json();
      if (data.title) {
        setTimelineName(data.title);
        if (timelineId) {
          await renameTimeline(timelineId, data.title);
        }
      }
    } catch (err) {
      console.error("Failed to generate AI title:", err);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const handleCopyTitle = () => {
    if (!timelineName) return;
    navigator.clipboard.writeText(timelineName);
    setIsCopiedTitle(true);
    setTimeout(() => setIsCopiedTitle(false), 2000);
  };

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
    setMaxWords,
    videoCanvas,
    setVideoCanvas,
    videoSegments,
    setVideoSegments
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
    audioSegments,
  });

  // Timeline dragging hook
  useTimelineDragging({
    draggingBoundary,
    setDraggingBoundary,
    trackRef,
    mediaDuration,
    videoSegments,
    editableSegments,
    setEditableSegments,
    setSegmentHistory,
    selectedIndexes,
  });

  useProjectPersistence({
    timelineId,
    timelineName,
    setTimelineName,
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
    audioSegments,
    setAudioSegments,
    videoCanvas,
    setVideoCanvas,
    subtitleStyle,
    setSubtitleStyle,
    setModelSize,
    setLanguage,
    setMaxWords,
    mediaRef,
  });

  const { handleTimelineSeek, currentSourceTime } = usePlaybackSync({
    mediaRef,
    audioRef,
    timelineRef,
    trackRef,
    mediaDuration,
    videoSegments,
    audioSegments,
    editableSegments,
    masterTimeRef,
    setMasterTime,
    masterTime,
    isPlayingRef,
    isHoveringTimeline,
    draggingBoundary,
    zoomLevel
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

  // Initialize video & audio segments when media duration is known (only once per media load)
  useEffect(() => {
    if (mediaDuration > 0 && videoSegments.length === 0 && !hasInitializedVideoRef.current) {
      const initialId = Math.random().toString(36).substr(2, 9);
      setVideoSegments([{
        id: initialId,
        sourceStart: 0,
        sourceEnd: mediaDuration,
        timelineStart: 0,
        timelineEnd: mediaDuration,
        deleted: false
      }]);
      setAudioSegments([{
        id: initialId + '_a',
        sourceStart: 0,
        sourceEnd: mediaDuration,
        timelineStart: 0,
        timelineEnd: mediaDuration,
        deleted: false,
        linkedVideoId: initialId,
      }]);
      hasInitializedVideoRef.current = true;
    } else if (mediaDuration === 0) {
      hasInitializedVideoRef.current = false;
    }
  }, [mediaDuration, videoSegments.length, setVideoSegments, setAudioSegments]);

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
      if (isPlayingRef.current) {
        mediaRef.current.pause();
        if (audioRef.current) audioRef.current.pause();
        setIsPlaying(false);
        isPlayingRef.current = false;
      } else {
        if (masterTime >= mediaDuration) {
          handleTimelineSeek(0);
        }

        // Align both video and audio clocks before starting playback
        const activeVideo = (videoSegments || []).find(s => !s.deleted && masterTime >= s.timelineStart && masterTime < s.timelineEnd) || videoSegments.find(s => !s.deleted);
        const activeAudio = (audioSegments || []).find(s => !s.deleted && masterTime >= s.timelineStart && masterTime < s.timelineEnd) || audioSegments.find(s => !s.deleted);

        if (activeVideo) {
          const expVideoTime = activeVideo.sourceStart + Math.max(0, masterTime - activeVideo.timelineStart);
          mediaRef.current.currentTime = Math.max(0, Math.min(mediaDuration, expVideoTime));
        }

        if (activeAudio && audioRef.current) {
          const expAudioTime = activeAudio.sourceStart + Math.max(0, masterTime - activeAudio.timelineStart);
          audioRef.current.currentTime = Math.max(0, Math.min(mediaDuration, expAudioTime));
        }

        if (audioRef.current) {
          mediaRef.current.muted = true;
          audioRef.current.play().catch(() => {});
        }
        mediaRef.current.play().catch(e => {
          if (e.name !== 'AbortError') console.error(e);
        });

        setIsPlaying(true);
        isPlayingRef.current = true;
      }
    }
  };

  const stopPlay = () => {
    if (mediaRef.current) {
      mediaRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
      handleTimelineSeek(0);
      setIsPlaying(false);
      isPlayingRef.current = false;
      if (timelineRef.current) {
        timelineRef.current.scrollLeft = 0;
      }
    }
  };

  const handleTimelineSeekRef = useRef(handleTimelineSeek);
  useEffect(() => {
    handleTimelineSeekRef.current = handleTimelineSeek;
  }, [handleTimelineSeek]);

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
    const handleEnded = () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
      handleTimelineSeekRef.current(0);
      if (timelineRef.current) {
        timelineRef.current.scrollLeft = 0;
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
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
          if (e.shiftKey) {
            handleRippleDelete(selectedIndexes);
          } else {
            handleLiftDelete(selectedIndexes);
          }
        }
        
        if (selectedVideoIndexes.length > 0) {
          if (e.shiftKey) {
            handleVideoRippleDelete(selectedVideoIndexes);
          } else {
            handleVideoDelete(selectedVideoIndexes);
          }
        }

        if (selectedAudioIndexes.length > 0) {
          if (e.shiftKey && handleAudioRippleDelete) {
            handleAudioRippleDelete(selectedAudioIndexes);
          } else if (handleAudioDelete) {
            handleAudioDelete(selectedAudioIndexes);
          }
        }
      } else if (e.code === 'KeyX') {
        e.preventDefault();
        e.stopPropagation();
        
        if (selectedIndexes.length > 0) {
          handleRippleDelete(selectedIndexes);
        }
        
        if (selectedVideoIndexes.length > 0) {
          handleVideoRippleDelete(selectedVideoIndexes);
        }

        if (selectedAudioIndexes.length > 0 && handleAudioRippleDelete) {
          handleAudioRippleDelete(selectedAudioIndexes);
        }
      } else if (e.code === 'KeyC' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (setCursorMode) setCursorMode(prev => prev === 'cut' ? 'select' : 'cut');
      } else if (e.code === 'KeyV' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (setCursorMode) setCursorMode('select');
      } else if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (setCursorMode) setCursorMode(prev => prev === 'resize' ? 'select' : 'resize');
      } else if (e.code === 'KeyJ' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (applyJCut) applyJCut(masterTime, 1.0);
      } else if (e.code === 'KeyL' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (applyLCut) applyLCut(masterTime, 1.0);
      } else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (e.code === 'KeyY' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editableSegments, togglePlay, setEditableSegments, setRippleDeletes, setSegmentHistory, rippleDeletes, setCursorMode, selectedVideoIndexes, selectedAudioIndexes, handleVideoDelete, handleAudioDelete, handleVideoRippleDelete, setSelectedVideoIndexes, setSelectedAudioIndexes, videoSegments, setVideoSegments, audioSegments, setAudioSegments, selectedIndexes, handleRippleDelete, handleLiftDelete, applyJCut, applyLCut, masterTime, undo, redo]);

  // Clear current project and persistent storage
  const clearProject = async () => {
    try {
      if (timelineId) {
        await deleteTimeline(timelineId);
      } else {
        const timelines = await getAllTimelines();
        for (const t of timelines) {
          await deleteTimeline(t.id);
        }
      }
      await del('capsync_project');
    } catch (e) {
      console.error('Failed to clear timelines from storage', e);
    }
    setFile(null);
    setStatus("idle");
    setResult(null);
    setEditableSegments([]);
    setRippleDeletes([]);
    setVideoSegments([]);
    setSelectedVideoIndexes([]);
    setMediaUrl("");
    setMediaDuration(0);
  };

  const generateSRT = () => {
    let srt = "";
    
    const toTimelineTime = (mediaTime: number) => {
      const activeSeg = videoSegments.find(s => mediaTime >= s.sourceStart && mediaTime <= s.sourceEnd && !s.deleted);
      if (activeSeg) {
        return activeSeg.timelineStart + (mediaTime - activeSeg.sourceStart);
      }
      const closest = [...videoSegments].filter(s => !s.deleted).sort((a, b) => Math.abs(a.sourceStart - mediaTime) - Math.abs(b.sourceStart - mediaTime))[0];
      if (closest) {
        return closest.timelineStart + (mediaTime - closest.sourceStart);
      }
      return mediaTime;
    };

    editableSegments.forEach((seg, idx) => {
      const realWords = seg.words ? seg.words.filter((w: any) => !w.deleted && !w.isGap) : [];
      if (realWords.length === 0 && seg.words && seg.words.length > 0) return;
      const text = realWords.length > 0 ? realWords.map((w: any) => w.word).join(" ") : seg.text;
      
      const tlStart = toTimelineTime(seg.start);
      const tlEnd = toTimelineTime(seg.end);
      
      srt += `${idx + 1}\n${formatSrtTime(tlStart)} --> ${formatSrtTime(tlEnd)}\n${text}\n\n`;
    });
    return srt;
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

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleSaveTitle = async () => {
    if (timelineId && titleInput.trim()) {
      setTimelineName(titleInput.trim());
      await renameTimeline(timelineId, titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  const handleDuplicateCurrentTimeline = async () => {
    if (timelineId) {
      const dup = await duplicateTimeline(timelineId);
      if (dup) {
        router.push(`/editor?id=${dup.id}`);
      }
    }
  };

  const handleDeleteCurrentTimeline = async () => {
    if (timelineId) {
      await deleteTimeline(timelineId);
      router.push('/');
    }
  };

  return (
    <div className="bg-neutral-950 text-neutral-50 font-sans selection:bg-blue-500/30 h-screen flex flex-col overflow-hidden p-4">
      {/* Top Header Bar with Timeline Navigation, Title & Actions */}
      <div className="mx-auto w-full max-w-[100rem] mb-3 flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => handleSafeNavigate('/')}
            className="text-neutral-400 hover:text-white hover:bg-neutral-800 gap-2 h-8 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Timelines
          </Button>

          <div className="h-4 w-[1px] bg-neutral-800" />

          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                className="h-8 text-sm font-bold bg-neutral-950 border-blue-500 w-64"
                autoFocus
              />
              <Button size="icon" className="h-8 w-8 bg-blue-600 hover:bg-blue-500" onClick={handleSaveTitle}>
                <Check className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setIsEditingTitle(true); setTitleInput(timelineName); }}>
              {projectName ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 bg-blue-950/60 border border-blue-800/40 px-2 py-0.5 rounded-md">
                  <Folder className="w-3.5 h-3.5" /> {projectName}
                </span>
              ) : (
                <Film className="w-4 h-4 text-blue-400" />
              )}
              <h2 className="font-bold text-sm text-neutral-100 group-hover:text-blue-400 transition-colors">
                {timelineName}
              </h2>
              <Edit2 className="w-3 h-3 text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateAiTitle();
            }}
            disabled={isGeneratingTitle || editableSegments.length === 0}
            className="h-7 w-7 text-purple-400 hover:text-purple-300 hover:bg-purple-950/50 rounded-md transition-colors shrink-0"
            title="Generate AI Title from Transcription (Gemini)"
          >
            {isGeneratingTitle ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyTitle();
            }}
            className="h-7 w-7 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors shrink-0"
            title="Copy Title to Clipboard"
          >
            {isCopiedTitle ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-2">
          {file && (
            <span className="bg-neutral-800 text-neutral-300 text-xs px-2.5 py-1 rounded-md font-semibold truncate max-w-[180px]">
              {file.name}
            </span>
          )}

          <div className="h-4 w-[1px] bg-neutral-800" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setIsEditingTitle(true); setTitleInput(timelineName); }}
            className="text-neutral-400 hover:text-white hover:bg-neutral-800 gap-1.5 h-8 text-xs font-semibold"
            title="Rename Timeline"
          >
            <Edit2 className="w-3.5 h-3.5" /> Rename
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDuplicateCurrentTimeline}
            className="text-neutral-400 hover:text-white hover:bg-neutral-800 gap-1.5 h-8 text-xs font-semibold"
            title="Duplicate Timeline"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsConfirmingDelete(true)}
            className="text-neutral-400 hover:text-red-400 hover:bg-neutral-800 gap-1.5 h-8 text-xs font-semibold"
            title="Delete Timeline"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Timeline?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-300 py-2">
            Are you sure you want to delete <span className="font-bold text-white">{timelineName}</span>? This action cannot be undone.
          </p>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsConfirmingDelete(false)}>Cancel</Button>
            <Button onClick={handleDeleteCurrentTimeline} variant="destructive" className="bg-red-600 hover:bg-red-500 font-semibold">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              isBusy={isBusy}
              file={file}
              editableSegments={editableSegments}
              setEditableSegments={setEditableSegments}
              selectedIndexes={selectedIndexes.filter(i => typeof i === 'number') as number[]}
              setSelectedIndexes={setSelectedIndexes}
              rippleDeletes={rippleDeletes}
              handleMergeSegments={handleMergeSegments}
              handleLiftDelete={handleLiftDelete}
              handleRippleDelete={handleRippleDelete}
              handleVideoDelete={handleVideoDelete}
              handleVideoRippleDelete={handleVideoRippleDelete}
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
                const activeSeg = videoSegments.find(s => !s.deleted && mediaTime >= s.sourceStart && mediaTime <= s.sourceEnd);
                const timelineTime = activeSeg ? activeSeg.timelineStart + (mediaTime - activeSeg.sourceStart) : mediaTime;
                handleTimelineSeek(timelineTime);
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

          <div className="lg:col-span-5 flex flex-col h-full overflow-hidden">
            <LivePreview 
              file={file}
              mediaUrl={mediaUrl}
              mediaRef={mediaRef}
              audioRef={audioRef}
              setCurrentTime={(sourceTime) => {
                const activeSeg = videoSegments.find(s => !s.deleted && sourceTime >= s.sourceStart && sourceTime <= s.sourceEnd);
                const timelineTime = activeSeg ? activeSeg.timelineStart + (sourceTime - activeSeg.sourceStart) : sourceTime;
                handleTimelineSeek(timelineTime);
              }}
              setMediaDuration={setMediaDuration}
              editableSegments={editableSegments}
              videoSegments={videoSegments}
              audioSegments={audioSegments}
              cutZones={cutZones}
              currentTime={masterTime}
              subtitleStyle={subtitleStyle}
              setVideoDimensions={setVideoDimensions}
              handleExportVideo={handleExportVideo}
              cancelTranscription={cancelTranscription}
              progress={progress}
              status={status}
              togglePlay={togglePlay}
              videoCanvas={videoCanvas}
              setVideoSegments={setVideoSegments}
            />
          </div>
        </div>

        {/* Bottom Interactive Timeline */}
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
          cutZones={cutZones}
          rippleDeletes={rippleDeletes}
          selectedIndexes={selectedIndexes}
          setSelectedIndexes={setSelectedIndexes}
          handleLiftDelete={handleLiftDelete}
          handleRippleDelete={handleRippleDelete}
          handleRippleDeleteRange={handleRippleDeleteRange}
          handleVideoDelete={handleVideoDelete}
          handleVideoRippleDelete={handleVideoRippleDelete}
          handleAudioDelete={handleAudioDelete}
          handleAudioRippleDelete={handleAudioRippleDelete}
          handleClearTrack={handleClearTrack}
          setDraggingBoundary={setDraggingBoundary}
          draggingBoundary={draggingBoundary}
          onSeek={(mediaTime) => {
            handleTimelineSeek(mediaTime);
          }}
          handleToggleWordDelete={handleToggleWordDelete}
          videoSegments={videoSegments}
          setVideoSegments={setVideoSegments}
          selectedVideoIndexes={selectedVideoIndexes}
          setSelectedVideoIndexes={setSelectedVideoIndexes}
          audioSegments={audioSegments}
          setAudioSegments={setAudioSegments}
          selectedAudioIndexes={selectedAudioIndexes}
          setSelectedAudioIndexes={setSelectedAudioIndexes}
          isAudioLinked={isAudioLinked}
          setIsAudioLinked={setIsAudioLinked}
          cursorMode={cursorMode}
          setCursorMode={setCursorMode}
          handleVideoCut={handleVideoCut}
          handleAudioCut={handleAudioCut}
          applyJCut={applyJCut}
          applyLCut={applyLCut}
          handleSubtitleCutAtTime={handleSubtitleCutAtTime}
          setEditableSegments={setEditableSegments}
          setSegmentHistory={setSegmentHistory}
          onGenerateTitle={handleGenerateAiTitle}
          isGeneratingTitle={isGeneratingTitle}
        />
      </div>
    </div>
  );
}

export default function WhisperXApp() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileAudio, FileVideo, Settings, Download, CheckCircle2, Loader2, CloudDownload, Video, Edit3, ZoomIn, ZoomOut, Trash2, Play, Pause } from "lucide-react";
import { get, set, del } from "idb-keyval";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingsPanel } from "./components/SettingsPanel";
import { SubtitleEditor } from "./components/SubtitleEditor";
import { LivePreview } from "./components/LivePreview";
import { InteractiveTimeline } from "./components/InteractiveTimeline";

// Helper function for SRT time formatting
const formatSrtTime = (seconds: number) => {
  const date = new Date(seconds * 1000);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
};

// Helper for UI time formatting (e.g., 00:12.3)
const formatUiTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
};

export default function WhisperXApp() {
  const [file, setFile] = useState<File | null>(null);
  
  // States
  const [modelSize, setModelSize] = useState("large-v2");
  const [language, setLanguage] = useState("");
  const [maxWords, setMaxWords] = useState("0");
  
  const [status, setStatus] = useState<"idle" | "uploading" | "downloading_model" | "transcribing" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadedModels, setDownloadedModels] = useState<Record<string, boolean>>({});

  // Editable subtitle segments
  const [editableSegments, setEditableSegments] = useState<any[]>([]);

  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState<number>(0);
  const [draggingBoundary, setDraggingBoundary] = useState<number | 'start' | 'end' | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLMediaElement>(null);

  const [isProjectLoaded, setIsProjectLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Load project from IndexedDB
  useEffect(() => {
    async function loadProject() {
      try {
        const savedProject = await get('capsync_project');
        if (savedProject) {
          if (savedProject.file) setFile(savedProject.file);
          if (savedProject.status) setStatus(savedProject.status);
          if (savedProject.result) setResult(savedProject.result);
          if (savedProject.editableSegments) setEditableSegments(savedProject.editableSegments);
        }
      } catch (err) {
        console.error("Failed to load project from IDB", err);
      } finally {
        setIsProjectLoaded(true);
      }
    }
    loadProject();
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

  // Load settings from local storage
  useEffect(() => {
    const savedModel = localStorage.getItem("whisperx_model");
    const savedLang = localStorage.getItem("whisperx_lang");
    const savedWords = localStorage.getItem("whisperx_words");
    
    if (savedModel) setModelSize(savedModel);
    if (savedLang !== null) setLanguage(savedLang);
    if (savedWords) setMaxWords(savedWords);
  }, []);

  // Save to local storage
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

  useEffect(() => {
    checkModelsStatus();
  }, []);

  // Poll for download progress if downloading model
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "downloading_model") {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/models/progress/${modelSize}`);
          if (res.ok) {
            const data = await res.json();
            if (data.progress !== null) {
              setProgress(data.progress);
            }
            if (data.status === "done" || data.progress === 100) {
              setStatus("transcribing");
              setProgress(0);
              checkModelsStatus();
            }
          }
        } catch (err) {}
      }, 500);
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

  const handleTranscribe = async () => {
    if (!file) return;

    setStatus("uploading");
    setProgress(10);
    setErrorMessage("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("model_name", modelSize);
    formData.append("max_words", maxWords);
    if (language) {
      formData.append("language", language);
    }

    try {
      if (!downloadedModels[modelSize]) {
        setTimeout(() => setStatus("downloading_model"), 500);
      } else {
        setStatus("transcribing");
        setProgress(40);
      }

      const response = await fetch("http://localhost:8000/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to transcribe audio.");
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      // Initialize the editable segments state
      setEditableSegments(data.segments);
      
      setProgress(100);
      setStatus("done");
      checkModelsStatus();
    } catch (err: any) {
      setErrorMessage(err.message || "An unknown error occurred.");
      setStatus("error");
      setProgress(0);
    }
  };

  const handleSegmentChange = (index: number, newText: string) => {
    const newSegments = [...editableSegments];
    newSegments[index] = { ...newSegments[index], text: newText };
    setEditableSegments(newSegments);
  };

  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (mediaRef.current.paused) {
      mediaRef.current.play();
    } else {
      mediaRef.current.pause();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return; // Ignore if typing
        }
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Smooth Auto-scroll timeline when playing
  const isHoveringTimeline = useRef(false);

  useEffect(() => {
    let animationFrameId: number;

    const smoothSync = () => {
      if (!mediaRef.current || mediaDuration <= 0) return;

      // 1. Smoothly center the horizontal Timeline Track
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

  // Auto-scroll the vertical Subtitle Editor list (runs on onTimeUpdate via currentTime dependency)
  useEffect(() => {
    if (!mediaRef.current || mediaRef.current.paused || mediaDuration <= 0) return;

    const activeIndex = editableSegments.findIndex((s: any) => currentTime >= s.start && currentTime <= s.end);
    if (activeIndex !== -1) {
      const activeElement = document.getElementById(`subtitle-segment-${activeIndex}`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTime, mediaDuration, editableSegments]);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent triggering if clicking a draggable boundary
    if ((e.target as HTMLElement).closest('.cursor-col-resize')) return;
    
    if (!trackRef.current || !mediaRef.current || mediaDuration <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min((clickX / rect.width) * mediaDuration, mediaDuration));
    
    setCurrentTime(newTime);
    mediaRef.current.currentTime = newTime;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingBoundary === null || !trackRef.current || mediaDuration <= 0) return;
      
      const rect = trackRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      let newTime = (clickX / rect.width) * mediaDuration;
      
      const newSegments = [...editableSegments];
      
      if (draggingBoundary === 'start') {
        const nextEnd = newSegments[0].end;
        newTime = Math.max(0, Math.min(newTime, nextEnd - 0.1));
        newSegments[0] = { ...newSegments[0], start: newTime };
      } else if (draggingBoundary === 'end') {
        const prevStart = newSegments[newSegments.length - 1].start;
        newTime = Math.max(prevStart + 0.1, Math.min(newTime, mediaDuration));
        newSegments[newSegments.length - 1] = { ...newSegments[newSegments.length - 1], end: newTime };
      } else {
        const prevStart = newSegments[draggingBoundary].start;
        const nextEnd = newSegments[draggingBoundary + 1].end;
        newTime = Math.max(prevStart + 0.1, Math.min(newTime, nextEnd - 0.1));
        newSegments[draggingBoundary] = { ...newSegments[draggingBoundary], end: newTime };
        newSegments[draggingBoundary + 1] = { ...newSegments[draggingBoundary + 1], start: newTime };
      }
      
      setEditableSegments(newSegments);
    };

    const handleMouseUp = () => {
      if (draggingBoundary !== null) {
        setDraggingBoundary(null);
      }
    };

    if (draggingBoundary !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingBoundary, editableSegments, mediaDuration]);

  // Horizontal mouse wheel scrolling for the timeline
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (timelineRef.current) {
        if (e.deltaY !== 0) {
          e.preventDefault();
          timelineRef.current.scrollLeft += e.deltaY;
        }
      }
    };

    const el = timelineRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
    }
    
    return () => {
      if (el) {
        el.removeEventListener('wheel', handleWheel);
      }
    };
  }, [status, result, mediaDuration]);

  // Convert WhisperX segments to SRT format using editableSegments
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

  const renderModelOption = (val: string, label: string) => {
    const isDownloaded = downloadedModels[val];
    return (
      <SelectItem value={val}>
        <div className="flex items-center gap-2">
          {label}
          {isDownloaded ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <CloudDownload className="w-3 h-3 text-neutral-500" />
          )}
        </div>
      </SelectItem>
    );
  };

  return (
    <div className={`bg-neutral-950 text-neutral-50 font-sans selection:bg-blue-500/30 ${status === "done" && result ? "h-screen flex flex-col overflow-hidden p-4" : "min-h-screen p-4 md:p-8"}`}>
      <div className={`mx-auto w-full transition-all duration-500 ease-in-out flex flex-col ${status === "done" && result ? "flex-1 overflow-hidden max-w-[100rem]" : "max-w-2xl"}`}>
        
        {/* Main 3 columns grid */}
        <div className={status === "done" && result ? "flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden mb-4" : "w-full"}>
        
          {/* Left Column (Controls & Settings) */}
          <div className={status === "done" && result ? "lg:col-span-3 space-y-6" : "w-full"}>
            <SettingsPanel 
              file={file}
              setFile={setFile}
              status={status}
              progress={progress}
              modelSize={modelSize}
              setModelSize={setModelSize}
              language={language}
              setLanguage={setLanguage}
              maxWords={maxWords}
              setMaxWords={setMaxWords}
              handleFileChange={handleFileChange}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              fileInputRef={fileInputRef}
              handleTranscribe={handleTranscribe}
              downloadedModels={downloadedModels}
            />
          </div>

          {/* Middle Column (Editable Subtitles List) */}
          {status === "done" && result && (
            <div className="lg:col-span-4 animate-in fade-in slide-in-from-bottom-4 duration-700 h-full overflow-hidden">
              <SubtitleEditor 
                editableSegments={editableSegments}
                currentTime={currentTime}
                handleSegmentChange={handleSegmentChange}
                clearProject={clearProject}
                downloadSRT={downloadSRT}
              />
            </div>
          )}

          {/* Right Column (Live Preview Studio) */}
          {status === "done" && result && (
            <div className="lg:col-span-5 animate-in fade-in slide-in-from-right-8 duration-700 h-full overflow-hidden">
              <LivePreview 
                file={file}
                mediaUrl={mediaUrl}
                mediaRef={mediaRef}
                setCurrentTime={setCurrentTime}
                setMediaDuration={setMediaDuration}
                editableSegments={editableSegments}
                currentTime={currentTime}
              />
            </div>
          )}

        </div>

        {/* Bottom Column (Interactive Timeline Editor) */}
        {status === "done" && result && mediaDuration > 0 && (
          <div className="shrink-0 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <InteractiveTimeline 
              isPlaying={isPlaying}
              togglePlay={togglePlay}
              currentTime={currentTime}
              mediaDuration={mediaDuration}
              zoomLevel={zoomLevel}
              setZoomLevel={setZoomLevel}
              timelineRef={timelineRef}
              isHoveringTimeline={isHoveringTimeline}
              trackRef={trackRef}
              handleTrackClick={handleTrackClick}
              editableSegments={editableSegments}
              setDraggingBoundary={setDraggingBoundary}
              draggingBoundary={draggingBoundary}
            />
          </div>
        )}

      </div>
    </div>
  );
}

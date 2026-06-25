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
import { resegmentTranscripts } from "@/lib/chunking";

export interface SubtitleStyle {
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  textColor: string;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
}

export type DragTarget = { type: 'start' | 'end' | 'both', index: number } | 'start' | 'end';

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
  const [transcriptionMessage, setTranscriptionMessage] = useState<string>("Processing media...");
  
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>({
    fontFamily: "Inter",
    fontWeight: "800",
    fontSize: 48,
    textColor: "#ffffff",
    strokeEnabled: false,
    strokeColor: "#000000",
    strokeWidth: 4,
    shadowEnabled: false,
    shadowColor: "#000000",
    shadowBlur: 10,
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    backgroundEnabled: false,
    backgroundColor: "#000000",
    backgroundOpacity: 50,
  });

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
  const [draggingBoundary, setDraggingBoundary] = useState<DragTarget | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // History for Undo/Redo
  const [segmentHistory, setSegmentHistory] = useState<{ past: any[][], future: any[][] }>({ past: [], future: [] });

  const updateSegments = (newSegments: any[] | ((prev: any[]) => any[])) => {
    setEditableSegments((prevSegments) => {
      const updated = typeof newSegments === 'function' ? newSegments(prevSegments) : newSegments;
      setSegmentHistory(prevHistory => ({
        past: [...prevHistory.past, prevSegments].slice(-50),
        future: []
      }));
      return updated;
    });
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLMediaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [isProjectLoaded, setIsProjectLoaded] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
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

  // Load subtitle style from localStorage
  useEffect(() => {
    const savedStyle = localStorage.getItem("capsync_subtitle_style");
    if (savedStyle) {
      try {
        setSubtitleStyle(JSON.parse(savedStyle));
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

  // Poll for download progress if downloading model, and poll for transcription status if transcribing
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
        } else if (status === "transcribing") {
          const res = await fetch(`http://127.0.0.1:8000/api/transcribe/status`);
          if (res.ok) {
            const data = await res.json();
            setTranscriptionMessage(data.status);
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

    abortControllerRef.current = new AbortController();

    try {
      if (!downloadedModels[modelSize]) {
        setTimeout(() => {
          setStatus(prev => prev !== "idle" && prev !== "error" ? "downloading_model" : prev);
        }, 500);
      } else {
        setStatus("transcribing");
        setProgress(40);
      }

      const response = await fetch("http://localhost:8000/api/transcribe", {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to transcribe audio.");
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      // Initialize the editable segments state (clear history on new transcript)
      setSegmentHistory({ past: [], future: [] });
      setEditableSegments(data.segments);
      
      setProgress(100);
      setStatus("done");
      checkModelsStatus();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStatus("idle");
        setProgress(0);
        return;
      }
      setErrorMessage(err.message || "An unknown error occurred.");
      setStatus("error");
      setProgress(0);
    }
  };

  const cancelTranscription = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStatus("idle");
    setProgress(0);
  };

  const handleResegment = () => {
    if (!result || !result.raw_segments) return;
    const newSegments = resegmentTranscripts(result.raw_segments, maxWords);
    
    // We update the segments directly to push to history, and update the IDB result
    updateSegments(newSegments);
    
    // Keep the main result object in sync so if they reload, they get the newly chunked segments
    const newResult = { ...result, segments: newSegments };
    setResult(newResult);
    set('capsync_project', {
      file: file,
      status: status,
      result: newResult,
      editableSegments: newSegments
    }).catch(console.error);
  };

  const handleSegmentChange = (index: number, newText: string) => {
    updateSegments((prev) => {
      const newSegments = [...prev];
      newSegments[index] = { ...newSegments[index], text: newText };
      return newSegments;
    });
  };

  const handleMergeSegments = (index1: number, index2: number) => {
    updateSegments((prev) => {
      const minIndex = Math.min(index1, index2);
      const maxIndex = Math.max(index1, index2);
      
      const newSegments = [...prev];
      const first = newSegments[minIndex];
      const second = newSegments[maxIndex];
      
      newSegments[minIndex] = {
        ...first,
        end: second.end,
        text: `${first.text.trim()} ${second.text.trim()}`.trim(),
        words: (first.words && second.words) ? [...first.words, ...second.words] : (first.words || second.words)
      };
      
      newSegments.splice(maxIndex, 1);
      return newSegments;
    });
  };

  const handleDeleteSegments = (indices: number[]) => {
    updateSegments((prev) => prev.filter((_, i) => !indices.includes(i)));
  };

  const handleDuplicateSegment = (index: number) => {
    updateSegments((prev) => {
      const newSegments = [...prev];
      const target = newSegments[index];
      
      // Split the current text exactly in half by words
      const textWords = target.text.trim().split(/\s+/);
      const textMid = Math.max(1, Math.ceil(textWords.length / 2));
      const firstText = textWords.slice(0, textMid).join(" ");
      const secondText = textWords.slice(textMid).join(" ");

      // Default to a perfect mathematical half for time
      let splitTime = target.start + (target.end - target.start) / 2;
      let firstWords = target.words;
      let secondWords = target.words;

      // If we have original Whisper word-level timestamps, use them for perfect audio accuracy
      if (target.words && target.words.length > 1) {
        const wordMid = Math.max(1, Math.ceil(target.words.length / 2));
        const midpointWord = target.words[wordMid - 1]; // Last word of first half
        if (midpointWord && midpointWord.end) {
          splitTime = midpointWord.end;
        } else if (midpointWord && midpointWord.start) {
          splitTime = midpointWord.start;
        }
        firstWords = target.words.slice(0, wordMid);
        secondWords = target.words.slice(wordMid);
      }
      
      const firstHalf = { ...target, end: splitTime, text: firstText, words: firstWords };
      const secondHalf = { ...target, start: splitTime, text: secondText, words: secondWords };
      
      newSegments.splice(index, 1, firstHalf, secondHalf);
      return newSegments;
    });
  };

  const handleOffsetSegments = (offsetSeconds: number) => {
    updateSegments((prev) => {
      return prev.map(segment => {
        // Also offset the underlying words array if it exists
        const offsetWords = segment.words ? segment.words.map((w: any) => ({
          ...w,
          start: Math.max(0, (w.start || 0) + offsetSeconds),
          end: Math.max(0, (w.end || 0) + offsetSeconds)
        })) : segment.words;

        return {
          ...segment,
          start: Math.max(0, segment.start + offsetSeconds),
          end: Math.max(0, segment.end + offsetSeconds),
          words: offsetWords
        };
      });
    });
  };

  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (mediaRef.current.paused) {
      mediaRef.current.play();
    } else {
      mediaRef.current.pause();
    }
  };

  const stopPlay = () => {
    if (!mediaRef.current) return;
    mediaRef.current.pause();
    mediaRef.current.currentTime = 0;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      // Play/Pause with Space
      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        togglePlay();
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !isInput) {
        e.preventDefault();
        if (e.shiftKey) {
          // Redo
          setSegmentHistory(prev => {
            if (prev.future.length === 0) return prev;
            const nextState = prev.future[0];
            setEditableSegments(nextState);
            return {
              past: [...prev.past, editableSegments],
              future: prev.future.slice(1)
            };
          });
        } else {
          // Undo
          setSegmentHistory(prev => {
            if (prev.past.length === 0) return prev;
            const prevState = prev.past[prev.past.length - 1];
            setEditableSegments(prevState);
            return {
              past: prev.past.slice(0, -1),
              future: [editableSegments, ...prev.future]
            };
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [editableSegments, togglePlay]);

  // Center the timeline on the playhead whenever the zoom level changes
  useEffect(() => {
    if (timelineRef.current && trackRef.current && mediaRef.current && mediaDuration > 0) {
      const trackWidth = trackRef.current.scrollWidth;
      const playheadX = (mediaRef.current.currentTime / mediaDuration) * trackWidth;
      const container = timelineRef.current;
      
      container.scrollLeft = playheadX - container.clientWidth / 2;
    }
  }, [zoomLevel, mediaDuration]);

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

    const activeIndex = editableSegments.findIndex((s: any) => currentTime >= s.start && currentTime < s.end);
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
      
      let newSegments = [...editableSegments];
      
      if (draggingBoundary === 'start') {
        const nextEnd = newSegments[0].end;
        newTime = Math.max(0, Math.min(newTime, nextEnd - 0.1));
        newSegments[0] = { ...newSegments[0], start: newTime };
      } else if (draggingBoundary === 'end') {
        const prevStart = newSegments[newSegments.length - 1].start;
        newTime = Math.max(prevStart + 0.1, Math.min(newTime, mediaDuration));
        newSegments[newSegments.length - 1] = { ...newSegments[newSegments.length - 1], end: newTime };
      } else {
        const { type, index } = draggingBoundary;
        const currSegment = newSegments[index];
        const nextSegment = newSegments[index + 1];

        if (type === 'start') {
          // Dragging the start of `index`. Cannot overlap with previous segment's end (if any).
          const prevEnd = index > 0 ? newSegments[index - 1].end : 0;
          newTime = Math.max(prevEnd, Math.min(newTime, currSegment.end - 0.1));
          newSegments[index] = { ...currSegment, start: newTime };
        } else if (type === 'end') {
          // Dragging the end of `index`. Cannot overlap with next segment's start (if any).
          const nextStart = index < newSegments.length - 1 ? newSegments[index + 1].start : mediaDuration;
          newTime = Math.max(currSegment.start + 0.1, Math.min(newTime, nextStart));
          newSegments[index] = { ...currSegment, end: newTime };
        } else if (type === 'both') {
          // Dragging boundary between index and index+1.
          const prevStart = currSegment.start;
          const nextEnd = nextSegment.end;
          newTime = Math.max(prevStart + 0.1, Math.min(newTime, nextEnd - 0.1));
          newSegments[index] = { ...currSegment, end: newTime };
          newSegments[index + 1] = { ...nextSegment, start: newTime };
        }
      }
      
      setEditableSegments(newSegments);
    };

    const handleMouseUp = () => {
      if (draggingBoundary !== null) {
        // We only commit history once the drag ends to avoid filling history with intermediate frames
        setSegmentHistory(prev => ({
          past: [...prev.past, editableSegments].slice(-50),
          future: []
        }));
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
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Zoom in or out based on scroll direction
          const zoomDelta = e.deltaY < 0 ? 0.5 : -0.5;
          setZoomLevel((prev) => Math.max(1, Math.min(10, prev + zoomDelta)));
        } else if (e.deltaY !== 0) {
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
    setSegmentHistory({ past: [], future: [] });
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
        
        {/* Main 3 columns grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden mb-4">
        
          {/* Left Column (Controls & Settings) */}
          <div className="lg:col-span-3 flex flex-col h-full overflow-hidden">
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
              cancelTranscription={cancelTranscription}
              handleResegment={handleResegment}
              result={result}
              transcriptionMessage={transcriptionMessage}
              clearProject={clearProject}
              subtitleStyle={subtitleStyle}
              setSubtitleStyle={setSubtitleStyle}
            />
          </div>

          {/* Middle Column (Editable Subtitles List) */}
          <div className="lg:col-span-4 animate-in fade-in slide-in-from-bottom-4 duration-700 h-full overflow-hidden">
            <SubtitleEditor 
              editableSegments={editableSegments}
              currentTime={currentTime}
              handleSegmentChange={handleSegmentChange}
              handleDeleteSegments={handleDeleteSegments}
              handleDuplicateSegment={handleDuplicateSegment}
              handleMergeSegments={handleMergeSegments}
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

          {/* Right Column (Live Preview Studio) */}
          <div className="lg:col-span-5 animate-in fade-in slide-in-from-right-8 duration-700 h-full overflow-hidden">
            <LivePreview 
              file={file}
              mediaUrl={mediaUrl}
              mediaRef={mediaRef}
              setCurrentTime={setCurrentTime}
              setMediaDuration={setMediaDuration}
              editableSegments={editableSegments}
              currentTime={currentTime}
              subtitleStyle={subtitleStyle}
            />
            </div>

        </div>

        {/* Bottom Column (Interactive Timeline Editor) */}
        <div className="shrink-0 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <InteractiveTimeline 
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            stopPlay={stopPlay}
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

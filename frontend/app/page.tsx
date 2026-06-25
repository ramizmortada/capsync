"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileAudio, FileVideo, Settings, Download, CheckCircle2, Loader2, CloudDownload, Video, Edit3, ZoomIn, ZoomOut, Trash2 } from "lucide-react";
import { get, set, del } from "idb-keyval";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(smoothSync);
    };

    videoEl.addEventListener('play', onPlay);
    videoEl.addEventListener('playing', onPlay);
    videoEl.addEventListener('seeked', () => {
      if (!videoEl.paused) onPlay();
    });

    if (!videoEl.paused) {
      onPlay();
    }

    return () => {
      videoEl.removeEventListener('play', onPlay);
      videoEl.removeEventListener('playing', onPlay);
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
          <Card className="w-full bg-neutral-900 border-neutral-800 shadow-2xl">
            <CardHeader className="text-center pb-8">
              <CardTitle className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
                WhisperX Studio
              </CardTitle>
              <CardDescription className="text-neutral-400 mt-2">
                Blazing fast AI transcription with perfect word-level timestamps.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Settings Area */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="model-size" className="text-neutral-300 flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Model Size
                  </Label>
                  <Select value={modelSize} onValueChange={setModelSize} disabled={status === "transcribing" || status === "uploading" || status === "downloading_model"}>
                    <SelectTrigger className="bg-neutral-800 border-neutral-700">
                      <SelectValue placeholder="Select model size" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-100">
                      {renderModelOption("tiny", "Tiny (Fastest)")}
                      {renderModelOption("base", "Base")}
                      {renderModelOption("medium", "Medium")}
                      {renderModelOption("large-v2", "Large-v2 (Best)")}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="language" className="text-neutral-300">Language (Optional)</Label>
                  <Select value={language} onValueChange={setLanguage} disabled={status === "transcribing" || status === "uploading" || status === "downloading_model"}>
                    <SelectTrigger className="bg-neutral-800 border-neutral-700">
                      <SelectValue placeholder="Auto-detect" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-100">
                      <SelectItem value="">Auto-detect</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-words" className="text-neutral-300">Max Words Per Caption</Label>
                  <Select value={maxWords} onValueChange={setMaxWords} disabled={status === "transcribing" || status === "uploading" || status === "downloading_model"}>
                    <SelectTrigger className="bg-neutral-800 border-neutral-700">
                      <SelectValue placeholder="Default" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-100">
                      <SelectItem value="0">Default (Strict Auto)</SelectItem>
                      <SelectItem value="-1">Smart Mode (Normal: ~5 words)</SelectItem>
                      <SelectItem value="-2">Smart Mode (Short: ~2-3 words)</SelectItem>
                      <SelectItem value="1">1 Word (Strict)</SelectItem>
                      <SelectItem value="2">2 Words (Strict)</SelectItem>
                      <SelectItem value="3">3 Words (Strict)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Upload Area */}
              {!file ? (
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-6 border-2 border-dashed border-neutral-700 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-neutral-800/50 transition-all duration-300 group"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="video/*,audio/*"
                  />
                  <Upload className="w-10 h-10 mx-auto text-neutral-500 group-hover:text-blue-400 transition-colors mb-4" />
                  <h3 className="text-sm font-medium text-neutral-200">Drag & Drop Media</h3>
                </div>
              ) : (
                <div className="border border-neutral-700 bg-neutral-800/50 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 truncate">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      {file.type.startsWith('video') ? (
                        <FileVideo className="w-5 h-5 text-blue-400" />
                      ) : (
                        <FileAudio className="w-5 h-5 text-blue-400" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="font-medium text-sm text-neutral-200 truncate">{file.name}</p>
                      <p className="text-xs text-neutral-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  
                  {status === "idle" || status === "error" ? (
                    <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="text-neutral-400 hover:text-white px-2">
                      Remove
                    </Button>
                  ) : status === "done" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 ml-2" />
                  ) : null}
                </div>
              )}

              {/* Progress Area */}
              {(status === "uploading" || status === "transcribing" || status === "downloading_model") && (
                <div className="space-y-3 pt-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-blue-400 font-medium animate-pulse">
                      {status === "uploading" ? "Uploading..." : 
                       status === "downloading_model" ? `Downloading Model (${progress}%)` : 
                       "Transcribing..."}
                    </span>
                    <span className="text-neutral-400">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5 bg-neutral-800" />
                </div>
              )}

              {/* Error Message */}
              {status === "error" && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                  {errorMessage}
                </div>
              )}
            </CardContent>

            <CardFooter className="pt-2">
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-5 shadow-xl shadow-blue-900/20 disabled:opacity-50 text-sm"
                disabled={!file || status === "uploading" || status === "transcribing" || status === "downloading_model"}
                onClick={handleTranscribe}
              >
                {status === "uploading" || status === "transcribing" || status === "downloading_model" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing Media</>
                ) : status === "done" ? (
                  "Transcribe Another"
                ) : (
                  "Start Transcription"
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Middle Column (Editable Subtitles List) */}
        {status === "done" && result && (
          <div className="lg:col-span-4 animate-in fade-in slide-in-from-bottom-4 duration-700 h-full overflow-hidden">
            <Card className="h-full flex flex-col bg-neutral-900 border-neutral-800 shadow-2xl overflow-hidden p-0 gap-0">
              <div className="p-4 border-b border-neutral-800 bg-neutral-900 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                  <Edit3 className="w-4 h-4 text-blue-400" /> Subtitle Editor
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={clearProject} variant="destructive" size="sm" className="gap-2 h-8 text-xs px-3 shadow-lg">
                    <Trash2 className="w-3 h-3" /> Clear
                  </Button>
                  <Button onClick={downloadSRT} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 h-8 text-xs px-3 shadow-lg shadow-emerald-900/20">
                    <Download className="w-3 h-3" /> Download .SRT
                  </Button>
                </div>
              </div>
              
              <ScrollArea className="flex-1 h-0 bg-neutral-950/50">
                <div className="p-0">
                  {editableSegments.map((segment, index) => {
                    const isActive = currentTime >= segment.start && currentTime <= segment.end;
                    return (
                      <div 
                        key={index} 
                        id={`subtitle-segment-${index}`}
                        className={`px-4 py-3 border-b transition-all duration-200 ${
                          isActive 
                            ? 'bg-blue-500/10 border-l-2 border-l-blue-500 border-b-blue-500/20' 
                            : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800/50 border-l-2 border-l-transparent'
                        }`}
                      >
                        <div className="text-xs text-neutral-500 mb-2 flex justify-between font-mono tracking-wider">
                          <span>{formatUiTime(segment.start)}</span>
                          <span>{formatUiTime(segment.end)}</span>
                        </div>
                        <textarea
                          value={segment.text}
                          onChange={(e) => handleSegmentChange(index, e.target.value)}
                          className="w-full bg-transparent text-sm text-neutral-200 outline-none resize-none font-medium placeholder-neutral-700"
                          rows={1}
                          onInput={(e) => {
                            e.currentTarget.style.height = 'auto';
                            e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>
          </div>
        )}

        {/* Right Column (Live Preview Studio) */}
        {status === "done" && result && (
          <div className="lg:col-span-5 animate-in fade-in slide-in-from-right-8 duration-700 h-full overflow-hidden">
            <div className="h-full rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl flex flex-col">
              <div className="p-4 bg-neutral-900 border-b border-neutral-800 text-sm font-medium text-neutral-400 flex items-center gap-2 shrink-0">
                <Video className="w-4 h-4 text-emerald-400" /> Live Preview Studio
              </div>
              
              <div className="bg-black flex-1 flex items-center justify-center relative min-h-[300px]">
                {file?.type.startsWith('video') ? (
                  <video 
                    ref={mediaRef as React.RefObject<HTMLVideoElement>}
                    src={mediaUrl || undefined} 
                    controls 
                    className="absolute inset-0 w-full h-full object-contain"
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setMediaDuration(e.currentTarget.duration)}
                  />
                ) : (
                  <div className="w-full flex items-center justify-center p-8">
                    <audio 
                      ref={mediaRef as React.RefObject<HTMLAudioElement>}
                      src={mediaUrl || undefined} 
                      controls 
                      className="w-full max-w-md"
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                      onLoadedMetadata={(e) => setMediaDuration(e.currentTarget.duration)}
                    />
                  </div>
                )}
              </div>

              {/* Simple Subtitle Text Box Below Video */}
              <div className="p-8 bg-neutral-950 border-t border-neutral-800 min-h-[140px] flex items-center justify-center shrink-0">
                {(() => {
                  const activeSegment = editableSegments.find((s: any) => currentTime >= s.start && currentTime <= s.end);
                  if (!activeSegment) return <span className="text-neutral-700 italic">...</span>;
                  
                  return (
                    <div className="text-center w-full">
                      <span className="font-medium text-2xl md:text-3xl text-white tracking-wide">
                        {activeSegment.text}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        </div>

        {/* Bottom Column (Interactive Timeline Editor) */}
        {status === "done" && result && mediaDuration > 0 && (
          <div className="shrink-0 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <Card className="bg-neutral-900 border-neutral-800 shadow-2xl p-2">
              
              {/* Zoom Controls */}
              <div className="flex items-center justify-between px-2 mb-2 gap-4">
                <div className="flex items-center gap-3 w-64 bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800">
                  <ZoomOut className="w-4 h-4 text-neutral-500" />
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    step="0.5" 
                    value={zoomLevel} 
                    onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                    className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                  />
                  <ZoomIn className="w-4 h-4 text-neutral-500" />
                </div>
              </div>

              {/* Scrollable Timeline Container */}
              <div 
                ref={timelineRef}
                onMouseEnter={() => isHoveringTimeline.current = true}
                onMouseLeave={() => isHoveringTimeline.current = false}
                className="relative h-24 bg-neutral-950 rounded-xl overflow-x-auto overflow-y-hidden select-none [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-neutral-950 [&::-webkit-scrollbar-thumb]:bg-neutral-800 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-700 transition-colors"
              >
                {/* Scaled Inner Track */}
                <div 
                  ref={trackRef}
                  className="relative h-full cursor-crosshair min-w-full"
                  style={{ width: `${zoomLevel * 100}%` }}
                  onPointerDown={handleTrackClick}
                >
                  {/* Time Ticks */}
                  <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGgwLjV2NDBIMHoiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] bg-repeat-x" />

                  {/* Dynamic Time Ruler */}
                  {(() => {
                    if (mediaDuration <= 0) return null;
                    const targetTicks = 10 * zoomLevel;
                    const idealInterval = mediaDuration / targetTicks;
                    const intervals = [0.1, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
                    let interval = intervals[intervals.length - 1];
                    for (const inv of intervals) {
                      if (inv >= idealInterval) {
                        interval = inv;
                        break;
                      }
                    }
                    
                    const ticks = [];
                    for (let t = 0; t <= mediaDuration; t += interval) {
                      ticks.push(t);
                    }
                    
                    return (
                      <div className="absolute top-0 left-0 right-0 h-4 border-b border-neutral-800 pointer-events-none">
                        {ticks.map((t) => (
                          <div 
                            key={`tick-${t}`} 
                            className="absolute top-0 h-full flex flex-col items-center border-l border-neutral-700"
                            style={{ left: `${(t / mediaDuration) * 100}%` }}
                          >
                            <span className="text-[9px] text-neutral-500 absolute top-0 -translate-x-1/2 pt-0.5 px-1 bg-neutral-950">
                              {formatUiTime(t)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Subtitle Blocks */}
                  {editableSegments.map((segment, index) => {
                    const left = (segment.start / mediaDuration) * 100;
                    const width = ((segment.end - segment.start) / mediaDuration) * 100;
                    const isActive = currentTime >= segment.start && currentTime <= segment.end;

                    return (
                      <div 
                        key={`block-${index}`}
                        className={`absolute top-4 bottom-4 rounded-md border-x flex items-center justify-start overflow-hidden transition-colors ${
                          isActive 
                            ? 'bg-blue-600/50 border-blue-400' 
                            : 'bg-neutral-800/80 border-neutral-700 hover:bg-neutral-700/80'
                        }`}
                        style={{
                          left: `${left}%`,
                          width: `${width}%`
                        }}
                      >
                        <span className="text-[10px] text-neutral-300 px-2 truncate">
                          {segment.text}
                        </span>
                      </div>
                    );
                  })}

                  {/* Draggable Boundaries */}
                  
                  {/* Start Boundary */}
                  {editableSegments.length > 0 && (
                    <div
                      onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary('start'); }}
                      className="absolute top-0 bottom-0 w-4 -ml-2 cursor-col-resize z-10 flex justify-center items-center group"
                      style={{ left: `${(editableSegments[0].start / mediaDuration) * 100}%` }}
                    >
                      <div className={`w-0.5 h-full transition-colors ${draggingBoundary === 'start' ? 'bg-emerald-400 w-1 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-blue-400/50 group-hover:bg-emerald-400 group-hover:w-1'}`} />
                    </div>
                  )}

                  {/* End Boundary */}
                  {editableSegments.length > 0 && (
                    <div
                      onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary('end'); }}
                      className="absolute top-0 bottom-0 w-4 -ml-2 cursor-col-resize z-10 flex justify-center items-center group"
                      style={{ left: `${(editableSegments[editableSegments.length - 1].end / mediaDuration) * 100}%` }}
                    >
                      <div className={`w-0.5 h-full transition-colors ${draggingBoundary === 'end' ? 'bg-emerald-400 w-1 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-blue-400/50 group-hover:bg-emerald-400 group-hover:w-1'}`} />
                    </div>
                  )}

                  {/* Shared Boundaries */}
                  {editableSegments.map((segment, index) => {
                    // The boundary is the END of the current segment
                    if (index === editableSegments.length - 1) return null; // Last segment has no right boundary to drag
                    
                    const left = (segment.end / mediaDuration) * 100;
                    
                    return (
                      <div
                        key={`boundary-${index}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setDraggingBoundary(index);
                        }}
                        className="absolute top-0 bottom-0 w-4 -ml-2 cursor-col-resize z-10 flex justify-center items-center group"
                        style={{ left: `${left}%` }}
                      >
                        {/* Visual indicator on hover/drag */}
                        <div className={`w-0.5 h-full transition-colors ${
                          draggingBoundary === index 
                            ? 'bg-emerald-400 w-1 shadow-[0_0_10px_rgba(52,211,153,0.8)]' 
                            : 'bg-neutral-600 group-hover:bg-emerald-400 group-hover:w-1'
                        }`} />
                      </div>
                    );
                  })}

                  {/* Playhead */}
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] z-20 pointer-events-none"
                    style={{ left: `${(currentTime / mediaDuration) * 100}%` }}
                  >
                    <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-red-500 rounded-full" />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadow3DEnabled?: boolean;
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  highlightColor: string;
  alignment: 'left' | 'center' | 'right';
  alignmentVertical: 'top' | 'middle' | 'bottom';
  positionY: number;
  animationStyle: 'none' | 'color' | 'box' | 'scale' | 'karaoke' | 'reveal';
  animationIn: 'none' | 'fade' | 'zoomIn' | 'zoomOut';
  animationOut: 'none' | 'fade' | 'zoomIn' | 'zoomOut';
  highlightBackgroundColor: string;
  scaleFactor: number;
  maxWidth: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface StylePreset {
  id: string;
  name: string;
  subtitleStyle: SubtitleStyle;
  modelSize: string;
  maxWords: string;
  isDefault?: boolean;
}

const DEFAULT_PRESETS: StylePreset[] = [
  {
    id: "default-studio",
    name: "Default",
    modelSize: "tiny",
    maxWords: "-1",
    isDefault: true,
    subtitleStyle: {
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
    }
  }
];

export type DragTarget = 
  | { type: 'start' | 'end' | 'both', index: number } 
  | { type: 'start' | 'end' | 'both', segmentIdx: number, wordIdx: number }
  | 'start' | 'end';

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

const injectPauseChips = (segs: any[]): any[] => {
  if (!segs || segs.length === 0) return segs;
  
  return segs.map((seg, idx) => {
    if (!seg.words || seg.words.length === 0) return seg;
    
    const cleanWords = seg.words.filter((w: any) => !w.isGap);
    const newWords: any[] = [];
    
    for (let i = 0; i < cleanWords.length; i++) {
      newWords.push(cleanWords[i]);
      
      if (i < cleanWords.length - 1) {
        const w1 = cleanWords[i];
        const w2 = cleanWords[i + 1];
        const gap = w2.start - w1.end;
        if (gap > 0.02) {
          newWords.push({
            word: `[Pause ${gap.toFixed(1)}s]`,
            start: w1.end,
            end: w2.start,
            isGap: true,
            deleted: false
          });
        }
      }
    }
    
    if (idx < segs.length - 1) {
      const nextSeg = segs[idx + 1];
      if (nextSeg.words && nextSeg.words.length > 0) {
        const wLast = cleanWords[cleanWords.length - 1];
        const nextCleanWords = nextSeg.words.filter((w: any) => !w.isGap);
        if (wLast && nextCleanWords.length > 0) {
          const wNextFirst = nextCleanWords[0];
          const gap = wNextFirst.start - wLast.end;
          if (gap > 0.02) {
            newWords.push({
              word: `[Pause ${gap.toFixed(1)}s]`,
              start: wLast.end,
              end: wNextFirst.start,
              isGap: true,
              deleted: false
            });
          }
        }
      }
    }
    
    return {
      ...seg,
      words: newWords
    };
  });
};

// Helper hook for robust local storage persistence (SSR safe)
export default function WhisperXApp() {
  const [file, setFile] = useState<File | null>(null);
  
  // States
  const [modelSize, setModelSize] = useState("tiny");
  const [language, setLanguage] = useState("");
  const [maxWords, setMaxWords] = useState("-1");
  const [transcriptionMessage, setTranscriptionMessage] = useState<string>("Processing media...");
  
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

  const [status, setStatus] = useState<"idle" | "uploading" | "downloading_model" | "transcribing" | "burning" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadedModels, setDownloadedModels] = useState<Record<string, boolean>>({});
  
  const [presets, setPresets] = useState<StylePreset[]>(DEFAULT_PRESETS);
  const [activePresetId, setActivePresetId] = useState<string>("default-studio");

  // Editable subtitle segments
  const [editableSegments, setEditableSegments] = useState<any[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<(number | string)[]>([]);
  const [rippleDeletes, setRippleDeletes] = useState<{start: number, end: number}[]>([]);

  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState<number>(0);
  const [videoDimensions, setVideoDimensions] = useState<{width: number, height: number}>({width: 1920, height: 1080});
  const [draggingBoundary, setDraggingBoundary] = useState<DragTarget | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [silenceThreshold, setSilenceThreshold] = useState<number>(1.0);
  const [safePadding, setSafePadding] = useState<number>(150);
  
  // History for Undo/Redo
  type HistoryState = { segments: any[]; rippleDeletes: { start: number; end: number }[] };
  const [segmentHistory, setSegmentHistory] = useState<{ past: HistoryState[], future: HistoryState[] }>({ past: [], future: [] });

  const updateSegments = (newSegments: any[] | ((prev: any[]) => any[])) => {
    setEditableSegments((prevSegments) => {
      const updated = typeof newSegments === 'function' ? newSegments(prevSegments) : newSegments;
      setSegmentHistory(prevHistory => ({
        past: [...prevHistory.past, { segments: prevSegments, rippleDeletes: [...rippleDeletes] }].slice(-50),
        future: []
      }));
      return updated;
    });
  };

  const markCustom = useCallback(() => {
    setActivePresetId("custom");
    localStorage.setItem("capsync_active_preset_id", "custom");
  }, []);

  const handleModelSizeChange = useCallback((size: string) => {
    setModelSize(size);
    markCustom();
  }, [markCustom]);

  const handleMaxWordsChange = useCallback((words: string) => {
    setMaxWords(words);
    markCustom();
  }, [markCustom]);

  const handleSubtitleStyleChange = useCallback((updater: React.SetStateAction<SubtitleStyle>) => {
    setSubtitleStyle(updater);
    markCustom();
  }, [markCustom]);
  
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
          if (savedProject.editableSegments) setEditableSegments(injectPauseChips(savedProject.editableSegments));
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
        const parsed = JSON.parse(savedStyle);
        setSubtitleStyle(prev => ({ ...prev, ...parsed }));
      } catch (err) {
        console.error("Failed to load subtitle style from localStorage", err);
      }
    }
    setIsStyleLoaded(true);
  }, []);

  // Load custom presets from localStorage on mount
  useEffect(() => {
    try {
      const savedPresets = localStorage.getItem("capsync_style_presets");
      if (savedPresets) {
        const parsed = JSON.parse(savedPresets);
        setPresets([...DEFAULT_PRESETS, ...parsed]);
      }
      
      const savedActivePresetId = localStorage.getItem("capsync_active_preset_id");
      if (savedActivePresetId) {
        setActivePresetId(savedActivePresetId);
      }
    } catch (e) {
      console.error("Failed to load presets", e);
    }
  }, []);

  const savePreset = (name: string) => {
    if (!name.trim()) return;
    const newPreset: StylePreset = {
      id: `preset-${Date.now()}`,
      name: name.trim(),
      subtitleStyle: { ...subtitleStyle },
      modelSize,
      maxWords,
    };
    
    const customPresets = presets.filter(p => !p.isDefault);
    const updatedCustomPresets = [...customPresets, newPreset];
    setPresets([...DEFAULT_PRESETS, ...updatedCustomPresets]);
    setActivePresetId(newPreset.id);
    
    localStorage.setItem("capsync_style_presets", JSON.stringify(updatedCustomPresets));
    localStorage.setItem("capsync_active_preset_id", newPreset.id);
  };

  const deletePreset = (presetId: string) => {
    const presetToDelete = presets.find(p => p.id === presetId);
    if (!presetToDelete || presetToDelete.isDefault) return;
    
    const updatedCustomPresets = presets.filter(p => !p.isDefault && p.id !== presetId);
    setPresets([...DEFAULT_PRESETS, ...updatedCustomPresets]);
    
    if (activePresetId === presetId) {
      setActivePresetId("default-studio");
    }
    
    localStorage.setItem("capsync_style_presets", JSON.stringify(updatedCustomPresets));
  };

  const applyPreset = (presetId: string) => {
    const selected = presets.find(p => p.id === presetId);
    if (!selected) return;
    
    setSubtitleStyle({
      ...selected.subtitleStyle,
      alignment: selected.subtitleStyle.alignment ?? 'center',
      alignmentVertical: selected.subtitleStyle.alignmentVertical ?? 'bottom',
      positionY: selected.subtitleStyle.positionY ?? 10,
      maxWidth: selected.subtitleStyle.maxWidth ?? 90,
      shadow3DEnabled: selected.subtitleStyle.shadow3DEnabled ?? false,
    });
    setModelSize(selected.modelSize || "large-v2");
    setMaxWords(selected.maxWords || "-1");
    setActivePresetId(presetId);
    
    localStorage.setItem("capsync_active_preset_id", presetId);
  };

  const updatePreset = (presetId: string) => {
    const updatedCustomPresets = presets.map(p => {
      if (p.id === presetId && !p.isDefault) {
        return {
          ...p,
          subtitleStyle: { ...subtitleStyle },
          modelSize,
          maxWords
        };
      }
      return p;
    });
    
    setPresets(updatedCustomPresets);
    setActivePresetId(presetId);
    
    const customPresetsOnly = updatedCustomPresets.filter(p => !p.isDefault);
    localStorage.setItem("capsync_style_presets", JSON.stringify(customPresetsOnly));
    localStorage.setItem("capsync_active_preset_id", presetId);
  };

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
      setRippleDeletes([]);
      setEditableSegments(injectPauseChips(data.segments));
      
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

  const handleExportVideo = async () => {
    if (!file || editableSegments.length === 0) return;

    setStatus("burning");
    setProgress(10);
    setErrorMessage("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("segments", JSON.stringify(editableSegments));
    formData.append("style", JSON.stringify(subtitleStyle));
    formData.append("videoWidth", videoDimensions.width.toString());
    formData.append("videoHeight", videoDimensions.height.toString());
    formData.append("cuts", JSON.stringify(cutZones));

    try {
      const response = await fetch("http://localhost:8000/api/burn", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to burn subtitles.");
      }

      // Handle the blob response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `captioned_${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      setStatus("done");
      setProgress(100);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An unknown error occurred during burning.");
      setStatus("done"); // revert to done to allow retry
    }
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

  const handleToggleWordDelete = (segmentIndex: number, wordIndex: number) => {
    updateSegments((prev) => {
      const newSegments = [...prev];
      const segment = { ...newSegments[segmentIndex] };
      if (segment.words) {
        const words = [...segment.words];
        const word = { ...words[wordIndex] };
        word.deleted = !word.deleted;
        words[wordIndex] = word;
        segment.words = words;
      }
      newSegments[segmentIndex] = segment;
      return newSegments;
    });
  };

  const handleToggleSegmentSilence = (segmentIndex: number) => {
    updateSegments((prev) => {
      const newSegments = [...prev];
      const segment = { ...newSegments[segmentIndex] };
      if (segment.words) {
        const realWords = segment.words.filter((w: any) => !w.isGap);
        const allSpokenDeleted = realWords.every((w: any) => w.deleted);
        const shouldDelete = !allSpokenDeleted;
        
        segment.words = segment.words.map((w: any) => ({
          ...w,
          deleted: shouldDelete
        }));
      }
      newSegments[segmentIndex] = segment;
      return newSegments;
    });
  };

  const handleAutoCutSilences = () => {
    updateSegments((prev) => {
      return prev.map((seg) => {
        if (!seg.words) return seg;
        const updatedWords = seg.words.map((word: any) => {
          if (word.isGap && (word.end - word.start) >= silenceThreshold) {
            return { ...word, deleted: true };
          }
          return word;
        });
        return { ...seg, words: updatedWords };
      });
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

  const handleLiftDelete = (indices: (number|string)[]) => {
    updateSegments((prev) => {
      const newSegments = [...prev];
      indices.forEach(idx => {
        if (typeof idx === 'number' && newSegments[idx]) {
          newSegments[idx] = { ...newSegments[idx] };
          if (newSegments[idx].words) {
            newSegments[idx].words = newSegments[idx].words.map((w: any) => ({ ...w, deleted: true }));
          }
        } else if (typeof idx === 'string' && (idx.startsWith('gap:') || idx.startsWith('word:'))) {
          const [, sIdx, wIdx] = idx.split(':').map(Number);
          if (newSegments[sIdx] && newSegments[sIdx].words && newSegments[sIdx].words[wIdx]) {
            newSegments[sIdx] = { ...newSegments[sIdx] };
            newSegments[sIdx].words = [...newSegments[sIdx].words];
            newSegments[sIdx].words[wIdx] = { ...newSegments[sIdx].words[wIdx], deleted: true };
          }
        }
      });
      return newSegments;
    });
  };

  const handleRippleDelete = (indices: (number|string)[]) => {
    const regionsToAdd: {start: number, end: number}[] = [];
    const segmentIndicesToDelete: number[] = [];
    
    indices.forEach(idx => {
      if (typeof idx === 'number') {
        segmentIndicesToDelete.push(idx);
        if (editableSegments[idx]) {
          regionsToAdd.push({ start: editableSegments[idx].start, end: editableSegments[idx].end });
        }
      } else if (typeof idx === 'string' && (idx.startsWith('gap:') || idx.startsWith('word:'))) {
        const [, sIdx, wIdx] = idx.split(':').map(Number);
        if (editableSegments[sIdx] && editableSegments[sIdx].words && editableSegments[sIdx].words[wIdx]) {
          const word = editableSegments[sIdx].words[wIdx];
          regionsToAdd.push({ start: word.start, end: word.end });
          handleToggleWordDelete(sIdx, wIdx);
        }
      }
    });
    setRippleDeletes(prev => [...prev, ...regionsToAdd]);
    if (segmentIndicesToDelete.length > 0) {
      handleDeleteSegments(segmentIndicesToDelete);
    }
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
      mediaRef.current.play().catch((err) => {
        // Ignore play request interruption errors
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
            setEditableSegments(nextState.segments);
            setRippleDeletes(nextState.rippleDeletes);
            return {
              past: [...prev.past, { segments: editableSegments, rippleDeletes: [...rippleDeletes] }],
              future: prev.future.slice(1)
            };
          });
        } else {
          // Undo
          setSegmentHistory(prev => {
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
  }, [editableSegments, togglePlay]);

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
  }, [editableSegments, safePadding]);

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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingBoundary === null || !trackRef.current || mediaDuration <= 0) return;
      
      const rect = trackRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      
      const sortedRippleDeletes = [...(rippleDeletes || [])].sort((a, b) => a.start - b.start);
      const toTimelineTime = (mediaTime: number) => {
        let timelineTime = mediaTime;
        for (const zone of sortedRippleDeletes) {
          if (mediaTime >= zone.end) {
            timelineTime -= (zone.end - zone.start);
          } else if (mediaTime > zone.start) {
            timelineTime -= (mediaTime - zone.start);
          }
        }
        return Math.max(0, timelineTime);
      };

      const toMediaTime = (timelineTime: number) => {
        let mediaTime = timelineTime;
        for (const zone of sortedRippleDeletes) {
          if (mediaTime >= zone.start) {
            mediaTime += (zone.end - zone.start);
          }
        }
        return Math.min(mediaTime, mediaDuration);
      };

      const timelineDuration = Math.max(toTimelineTime(mediaDuration), 0.1);
      const percentage = clickX / rect.width;
      const targetTimelineTime = percentage * timelineDuration;
      let newTime = toMediaTime(targetTimelineTime);
      
      let newSegments = [...editableSegments];
      
      if (draggingBoundary === 'start') {
        const nextEnd = newSegments[0].end;
        newTime = Math.max(0, Math.min(newTime, nextEnd - 0.1));
        const seg = { ...newSegments[0], start: newTime };
        if (seg.words && seg.words.length > 0) {
          const words = [...seg.words];
          words[0] = { ...words[0], start: newTime };
          seg.words = words;
        }
        newSegments[0] = seg;
      } else if (draggingBoundary === 'end') {
        const prevStart = newSegments[newSegments.length - 1].start;
        newTime = Math.max(prevStart + 0.1, Math.min(newTime, mediaDuration));
        const seg = { ...newSegments[newSegments.length - 1], end: newTime };
        if (seg.words && seg.words.length > 0) {
          const words = [...seg.words];
          const lastIdx = words.length - 1;
          words[lastIdx] = { ...words[lastIdx], end: newTime };
          seg.words = words;
        }
        newSegments[newSegments.length - 1] = seg;
      } else {
        const boundary = draggingBoundary as any;
        if ('wordIdx' in boundary) {
          const { type, segmentIdx, wordIdx } = boundary;
          const currSegment = newSegments[segmentIdx];
          const currWords = [...(currSegment.words || [])];
          const currWord = currWords[wordIdx];
          const nextWord = currWords[wordIdx + 1];

          if (type === 'start') {
            const prevWord = wordIdx > 0 ? currWords[wordIdx - 1] : null;
            const prevEnd = prevWord ? prevWord.end : currSegment.start;
            
            if (prevWord && prevWord.isGap) {
              // Can drag into the gap. Minimum duration of word is 0.05.
              const minStart = prevWord.start + 0.02; 
              newTime = Math.max(minStart, Math.min(newTime, currWord.end - 0.05));
              // Adjust gap end
              currWords[wordIdx - 1] = { ...prevWord, end: newTime };
            } else {
              newTime = Math.max(prevEnd, Math.min(newTime, currWord.end - 0.05));
            }
            currWords[wordIdx] = { ...currWord, start: newTime };
          } else if (type === 'end') {
            const nextWord = wordIdx < currWords.length - 1 ? currWords[wordIdx + 1] : null;
            const nextStart = nextWord ? nextWord.start : currSegment.end;
            
            if (nextWord && nextWord.isGap) {
              // Can drag into the gap. Minimum duration of word is 0.05.
              const maxEnd = nextWord.end - 0.02;
              newTime = Math.max(currWord.start + 0.05, Math.min(newTime, maxEnd));
              // Adjust gap start
              currWords[wordIdx + 1] = { ...nextWord, start: newTime };
            } else {
              newTime = Math.max(currWord.start + 0.05, Math.min(newTime, nextStart));
            }
            currWords[wordIdx] = { ...currWord, end: newTime };
          } else if (type === 'gap-ripple') {
            const gapWord = currWords[wordIdx];
            const oldEnd = gapWord.end;
            // Bound newTime: gap cannot have negative duration or exceed media duration
            newTime = Math.max(gapWord.start + 0.02, Math.min(newTime, mediaDuration));
            const delta = newTime - oldEnd;

            if (Math.abs(delta) > 0.001) {
              // Adjust the gap word itself
              currWords[wordIdx] = { ...gapWord, end: newTime };

              // Ripple-shift all subsequent words in the current segment
              for (let i = wordIdx + 1; i < currWords.length; i++) {
                currWords[i] = {
                  ...currWords[i],
                  start: currWords[i].start + delta,
                  end: currWords[i].end + delta
                };
              }
              currSegment.words = currWords;
              currSegment.end += delta;
              newSegments[segmentIdx] = currSegment;

              // Ripple-shift all subsequent parent segments on the timeline
              for (let s = segmentIdx + 1; s < newSegments.length; s++) {
                const nextSeg = { ...newSegments[s] };
                nextSeg.start += delta;
                nextSeg.end += delta;
                if (nextSeg.words) {
                  nextSeg.words = nextSeg.words.map((w: any) => ({
                    ...w,
                    start: w.start + delta,
                    end: w.end + delta
                  }));
                }
                newSegments[s] = nextSeg;
              }
            }
          } else if (type === 'both' && nextWord) {
            const minBound = currWord.start + 0.02;
            const maxBound = nextWord.end - 0.02;
            newTime = Math.max(minBound, Math.min(newTime, maxBound));
            currWords[wordIdx] = { ...currWord, end: newTime };
            currWords[wordIdx + 1] = { ...nextWord, start: newTime };
            newSegments[segmentIdx] = { ...currSegment, words: currWords };
          }
        } else {
          const { type, index } = boundary;
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
            
            // Update parent segment times
            currSegment.end = newTime;
            nextSegment.start = newTime;

            // Also update the last word of current segment
            if (currSegment.words && currSegment.words.length > 0) {
              const words = [...currSegment.words];
              const lastWordIdx = words.length - 1;
              words[lastWordIdx] = { ...words[lastWordIdx], end: newTime };
              currSegment.words = words;
            }

            // Also update the first word of the next segment
            if (nextSegment.words && nextSegment.words.length > 0) {
              const words = [...nextSegment.words];
              words[0] = { ...words[0], start: newTime };
              nextSegment.words = words;
            }

            newSegments[index] = currSegment;
            newSegments[index + 1] = nextSegment;
          }
        }
      }
      
      setEditableSegments(newSegments);
    };

    const handleMouseUp = () => {
      if (draggingBoundary !== null) {
        // We only commit history once the drag ends to avoid filling history with intermediate frames
        setSegmentHistory(prev => ({
          past: [...prev.past, { segments: editableSegments, rippleDeletes: [...rippleDeletes] }].slice(-50),
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
              handleResegment={handleResegment}
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

          {/* Middle Column (Editable Subtitles List) */}
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

          {/* Right Column (Live Preview Studio) */}
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

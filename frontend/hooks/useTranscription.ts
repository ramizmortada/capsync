import { useState, useRef } from "react";

export function mapTranscriptionToTimeline(rawSegments: any[], videoSegments: any[]) {
  const activeSegs = (videoSegments || []).filter((s: any) => !s.deleted);
  if (activeSegs.length === 0) return rawSegments;

  const isTimeInActiveRange = (sourceTime: number): boolean => {
    return activeSegs.some(
      (s: any) => sourceTime >= s.sourceStart - 0.05 && sourceTime <= s.sourceEnd + 0.05
    );
  };

  const processedSegments: any[] = [];

  for (const seg of rawSegments) {
    let mappedWords: any[] = [];
    if (seg.words && seg.words.length > 0) {
      mappedWords = seg.words.filter((w: any) => isTimeInActiveRange(w.start) && isTimeInActiveRange(w.end));
      if (mappedWords.length === 0) continue;
    } else {
      // If no words, check if the segment boundaries are in active range
      if (!isTimeInActiveRange(seg.start) && !isTimeInActiveRange(seg.end)) {
        continue;
      }
    }

    const firstWord = mappedWords[0];
    const lastWord = mappedWords[mappedWords.length - 1];

    const finalStart = firstWord ? firstWord.start : seg.start;
    const finalEnd = lastWord ? Math.max(lastWord.end, seg.end) : seg.end;

    const segmentText = mappedWords.length > 0
      ? mappedWords.map((w: any) => w.word || w.text).join(" ")
      : seg.text;

    processedSegments.push({
      ...seg,
      id: Math.random().toString(36).substr(2, 9),
      start: finalStart,
      end: finalEnd,
      text: segmentText,
      words: mappedWords
    });
  }

  return processedSegments;
}

export function useTranscription({
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
}: {
  file: File | null;
  status: string;
  setStatus: (s: any) => void;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
  setResult: (r: any) => void;
  setErrorMessage: (m: string) => void;
  editableSegments: any[];
  setEditableSegments: (segs: any[]) => void;
  subtitleStyle: any;
  videoDimensions: { width: number; height: number };
  cutZones: any[];
  setSegmentHistory: (h: any) => void;
  setRippleDeletes: (r: any[]) => void;
  checkModelsStatus: () => void;
  downloadedModels: Record<string, boolean>;
  modelSize: string;
  maxWords: string;
  language: string;
  videoCanvas: any;
  videoSegments: any[];
}) {
  const [transcriptionMessage, setTranscriptionMessage] = useState<string>("Processing media...");
  const abortControllerRef = useRef<AbortController | null>(null);
  const exportAbortControllerRef = useRef<AbortController | null>(null);

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
          setStatus((prev: string) => prev !== "idle" && prev !== "error" ? "downloading_model" : prev);
        }, 500);
      } else {
        setStatus("transcribing");
        setProgress(40);
      }

      const response = await fetch("http://127.0.0.1:8000/api/transcribe", {
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
      setSegmentHistory({ past: [], future: [] });
      setRippleDeletes([]);
      const mappedSegments = mapTranscriptionToTimeline(data.segments, videoSegments);
      setEditableSegments(mappedSegments);
      
      setProgress(100);
      setStatus("done");
      checkModelsStatus();
    } catch (err: any) {
      if (err.name === 'AbortError' || err.code === 20 || err === "Transcription cancelled by user" || abortControllerRef.current?.signal.aborted) {
        setStatus("idle");
        setProgress(0);
        return;
      }
      setErrorMessage(err.message || "An unknown error occurred.");
      setStatus("error");
      setProgress(0);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const cancelTranscription = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("Transcription cancelled by user");
      abortControllerRef.current = null;
    }
    if (exportAbortControllerRef.current) {
      exportAbortControllerRef.current.abort("Export cancelled by user");
      exportAbortControllerRef.current = null;
    }
    try {
      await fetch("http://127.0.0.1:8000/api/cancel", { method: "POST" });
    } catch (e) {
      console.error("Failed to notify backend cancel:", e);
    }
    setStatus("idle");
    setProgress(0);
  };

  const handleExportVideo = async () => {
    if (!file) return;

    setStatus("burning");
    setProgress(0);
    setErrorMessage("");

    exportAbortControllerRef.current = new AbortController();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("segments", JSON.stringify(editableSegments || []));
    formData.append("style", JSON.stringify(subtitleStyle));
    formData.append("videoWidth", (videoDimensions.width || 1920).toString());
    formData.append("videoHeight", (videoDimensions.height || 1080).toString());
    formData.append("cuts", JSON.stringify(cutZones || []));
    formData.append("videoCanvas", JSON.stringify(videoCanvas || { type: 'auto' }));
    formData.append("videoSegments", JSON.stringify(videoSegments || []));

    const progressTimer = setInterval(async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/burn/progress");
        if (res.ok) {
          const data = await res.json();
          if (typeof data.progress === "number") {
            setProgress(data.progress);
          }
        }
      } catch (e) {
        // Ignore polling fetch errors
      }
    }, 400);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/burn", {
        method: "POST",
        body: formData,
        signal: exportAbortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to render and export video.");
      }

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
      if (err.name === 'AbortError' || exportAbortControllerRef.current?.signal.aborted) {
        setStatus("idle");
        setProgress(0);
        return;
      }
      console.error(err);
      setErrorMessage(err.message || "An unknown error occurred during video export.");
      setStatus("error");
      setProgress(0);
    } finally {
      clearInterval(progressTimer);
      exportAbortControllerRef.current = null;
    }
  };

  return {
    transcriptionMessage,
    setTranscriptionMessage,
    handleTranscribe,
    cancelTranscription,
    handleExportVideo,
  };
}

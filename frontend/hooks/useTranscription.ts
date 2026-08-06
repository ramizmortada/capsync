import { useState, useRef } from "react";

export function mapTranscriptionToTimeline(rawSegments: any[], videoSegments: any[]) {
  const activeSegs = (videoSegments || []).filter((s: any) => !s.deleted);
  if (activeSegs.length === 0) return rawSegments;

  const mapTimeToTimeline = (sourceTime: number): number | null => {
    const seg = activeSegs.find(
      (s: any) => sourceTime >= s.sourceStart - 0.05 && sourceTime <= s.sourceEnd + 0.05
    );
    if (!seg) return null;
    return seg.timelineStart + Math.max(0, Math.min(seg.timelineEnd - seg.timelineStart, sourceTime - seg.sourceStart));
  };

  const processedSegments: any[] = [];

  for (const seg of rawSegments) {
    let mappedWords: any[] = [];
    if (seg.words && seg.words.length > 0) {
      mappedWords = seg.words
        .map((w: any) => {
          const wStart = mapTimeToTimeline(w.start);
          const wEnd = mapTimeToTimeline(w.end);
          if (wStart === null || wEnd === null) return null;
          return {
            ...w,
            start: wStart,
            end: wEnd,
            word: w.word || w.text
          };
        })
        .filter(Boolean);

      if (mappedWords.length === 0) continue;
    }

    const mappedStart = mapTimeToTimeline(seg.start);
    const mappedEnd = mapTimeToTimeline(seg.end);

    if (mappedStart === null && mappedEnd === null && mappedWords.length === 0) continue;

    const firstWord = mappedWords[0];
    const lastWord = mappedWords[mappedWords.length - 1];

    const finalStart = firstWord ? firstWord.start : (mappedStart ?? 0);
    const finalEnd = lastWord ? lastWord.end : (mappedEnd ?? finalStart + 1);

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
  setProgress: (p: number) => void;
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
    }
  };

  const cancelTranscription = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("Transcription cancelled by user");
      abortControllerRef.current = null;
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
    formData.append("videoCanvas", JSON.stringify(videoCanvas));
    formData.append("videoSegments", JSON.stringify(videoSegments));

    try {
      const response = await fetch("http://127.0.0.1:8000/api/burn", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to burn subtitles.");
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
      console.error(err);
      setErrorMessage(err.message || "An unknown error occurred during burning.");
      setStatus("done");
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

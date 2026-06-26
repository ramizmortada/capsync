import { useState, useRef } from "react";
import { injectPauseChips } from "@/lib/utils";

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

"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileAudio, FileVideo, CheckCircle2, Loader2, Download, Settings, Database, CloudDownload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from local storage
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
            setProgress(data.progress);
            if (data.status === "done" || data.progress === 100) {
              setStatus("transcribing");
              setProgress(0); // reset to show indeterminate transcription progress
              checkModelsStatus(); // refresh list
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
      // If model is not downloaded, switch to downloading status immediately
      if (!downloadedModels[modelSize]) {
        setTimeout(() => setStatus("downloading_model"), 500);
      } else {
        setStatus("transcribing");
        setProgress(40);
      }

      // Send to FastAPI backend
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
      setProgress(100);
      setStatus("done");
      checkModelsStatus(); // refresh after success just in case
    } catch (err: any) {
      setErrorMessage(err.message || "An unknown error occurred.");
      setStatus("error");
      setProgress(0);
    }
  };

  // Convert WhisperX segments to SRT format
  const generateSRT = () => {
    if (!result || !result.segments) return "";
    
    let srtContent = "";
    result.segments.forEach((segment: any, index: number) => {
      const formatTime = (seconds: number) => {
        const date = new Date(seconds * 1000);
        const hh = String(date.getUTCHours()).padStart(2, '0');
        const mm = String(date.getUTCMinutes()).padStart(2, '0');
        const ss = String(date.getUTCSeconds()).padStart(2, '0');
        const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
        return `${hh}:${mm}:${ss},${ms}`;
      };

      srtContent += `${index + 1}\n`;
      srtContent += `${formatTime(segment.start)} --> ${formatTime(segment.end)}\n`;
      srtContent += `${segment.text.trim()}\n\n`;
    });
    
    return srtContent;
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
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-neutral-900 border-neutral-800 shadow-2xl">
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
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* New row for Max Words */}
          <div className="space-y-2">
            <Label htmlFor="max-words" className="text-neutral-300">Max Words Per Caption (For Short-form Video)</Label>
            <Select value={maxWords} onValueChange={setMaxWords} disabled={status === "transcribing" || status === "uploading" || status === "downloading_model"}>
              <SelectTrigger className="bg-neutral-800 border-neutral-700">
                <SelectValue placeholder="Default (Auto length)" />
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

          {/* Upload Area */}
          {!file ? (
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 border-2 border-dashed border-neutral-700 rounded-xl p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-neutral-800/50 transition-all duration-300 group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="video/*,audio/*"
              />
              <Upload className="w-12 h-12 mx-auto text-neutral-500 group-hover:text-blue-400 transition-colors mb-4" />
              <h3 className="text-lg font-medium text-neutral-200">Drag & Drop Media</h3>
              <p className="text-sm text-neutral-500 mt-2">or click to browse your computer</p>
            </div>
          ) : (
            <div className="border border-neutral-700 bg-neutral-800/50 rounded-xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-4 truncate">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  {file.type.startsWith('video') ? (
                    <FileVideo className="w-6 h-6 text-blue-400" />
                  ) : (
                    <FileAudio className="w-6 h-6 text-blue-400" />
                  )}
                </div>
                <div className="truncate">
                  <p className="font-medium text-neutral-200 truncate">{file.name}</p>
                  <p className="text-xs text-neutral-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
              </div>
              
              {status === "idle" || status === "error" ? (
                <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="text-neutral-400 hover:text-white">
                  Remove
                </Button>
              ) : status === "done" ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              ) : null}
            </div>
          )}

          {/* Progress Area */}
          {(status === "uploading" || status === "transcribing" || status === "downloading_model") && (
            <div className="space-y-3 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-blue-400 font-medium animate-pulse">
                  {status === "uploading" ? "Uploading to AI Engine..." : 
                   status === "downloading_model" ? `Downloading AI Model (${progress}%)` : 
                   "Transcribing via WhisperX..."}
                </span>
                <span className="text-neutral-400">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-neutral-800" />
            </div>
          )}

          {/* Error Message */}
          {status === "error" && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {errorMessage}
            </div>
          )}

          {/* Results Area */}
          {status === "done" && result && (
            <div className="pt-6 border-t border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-neutral-200">Transcription Complete</h3>
                  <p className="text-sm text-neutral-500">Detected language: {result.language}</p>
                </div>
                <Button onClick={downloadSRT} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shadow-lg shadow-emerald-900/20">
                  <Download className="w-4 h-4" /> Download .SRT
                </Button>
              </div>
              
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg h-48 overflow-y-auto text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed font-mono">
                {result.segments.map((s: any) => s.text).join(' ')}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-2">
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-6 shadow-xl shadow-blue-900/20 disabled:opacity-50"
            disabled={!file || status === "uploading" || status === "transcribing" || status === "downloading_model"}
            onClick={handleTranscribe}
          >
            {status === "uploading" || status === "transcribing" || status === "downloading_model" ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing Media</>
            ) : status === "done" ? (
              "Transcribe Another File"
            ) : (
              "Start Transcription"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

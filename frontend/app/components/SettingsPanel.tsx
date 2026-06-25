import { Upload, FileAudio, FileVideo, Settings, CloudDownload, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

interface SettingsPanelProps {
  file: File | null;
  setFile: (file: File | null) => void;
  status: "idle" | "uploading" | "downloading_model" | "transcribing" | "done" | "error";
  progress: number;
  modelSize: string;
  setModelSize: (s: string) => void;
  language: string;
  setLanguage: (s: string) => void;
  maxWords: string;
  setMaxWords: (s: string) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleTranscribe: () => void;
  downloadedModels: Record<string, boolean>;
}

export function SettingsPanel({
  file,
  setFile,
  status,
  progress,
  modelSize,
  setModelSize,
  language,
  setLanguage,
  maxWords,
  setMaxWords,
  handleFileChange,
  handleDragOver,
  handleDrop,
  fileInputRef,
  handleTranscribe,
  downloadedModels,
}: SettingsPanelProps) {
  
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
              <span className="text-neutral-400 font-mono">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-neutral-800" />
          </div>
        )}
      </CardContent>
      
      <CardFooter className="bg-neutral-900/50 border-t border-neutral-800 p-6 rounded-b-xl">
        <Button 
          onClick={handleTranscribe} 
          disabled={!file || status === "uploading" || status === "transcribing" || status === "downloading_model"} 
          className="w-full font-semibold shadow-md transition-all duration-300"
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
  );
}

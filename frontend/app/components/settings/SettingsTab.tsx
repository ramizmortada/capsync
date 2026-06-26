import { Bot, Upload, FileVideo, FileAudio, CheckCircle2, CloudDownload, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface SettingsTabProps {
  status: "idle" | "uploading" | "downloading_model" | "transcribing" | "burning" | "done" | "error";
  modelSize: string;
  setModelSize: (s: string) => void;
  language: string;
  setLanguage: (s: string) => void;
  maxWords: string;
  setMaxWords: (s: string) => void;
  downloadedModels: Record<string, boolean>;
  file: File | null;
  setFile: (file: File | null) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  transcriptionMessage: string;
  progress: number;
  cancelTranscription: () => void;
  handleTranscribe: () => void;
  handleResegment: () => void;
  clearProject: () => void;
  result: any;
}

export const SettingsTab = ({
  status,
  modelSize,
  setModelSize,
  language,
  setLanguage,
  maxWords,
  setMaxWords,
  downloadedModels,
  file,
  setFile,
  handleFileChange,
  handleDragOver,
  handleDrop,
  fileInputRef,
  transcriptionMessage,
  progress,
  cancelTranscription,
  handleTranscribe,
  handleResegment,
  clearProject,
  result,
}: SettingsTabProps) => {
  
  const renderModelOption = (val: string, label: string) => {
    const isDownloaded = downloadedModels[val];
    return (
      <SelectItem value={val}>
        <div className="flex items-center gap-2">
          {label}
          {isDownloaded ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <CloudDownload className="w-3 h-3 text-muted-foreground/80" />
          )}
        </div>
      </SelectItem>
    );
  };

  return (
    <div className="p-6 m-0 space-y-6">
      {/* Settings Area */}
      <div className="grid grid-cols-1 gap-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="model-size" className="text-neutral-300 flex items-center gap-2">
            <Bot className="w-4 h-4" /> Model Size
          </Label>
          <Select 
            value={modelSize} 
            onValueChange={setModelSize} 
            disabled={status === "transcribing" || status === "uploading" || status === "downloading_model"}
          >
            <SelectTrigger className="bg-neutral-800 border-neutral-700 w-[180px]">
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
        
        <div className="flex items-center justify-between">
          <Label htmlFor="language" className="text-neutral-300">Language (Optional)</Label>
          <Select 
            value={language} 
            onValueChange={setLanguage} 
            disabled={status === "transcribing" || status === "uploading" || status === "downloading_model"}
          >
            <SelectTrigger className="bg-neutral-800 border-neutral-700 w-[180px]">
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

        <div className="flex items-center justify-between">
          <Label htmlFor="max-words" className="text-neutral-300">Caption Length</Label>
          <Select 
            value={maxWords} 
            onValueChange={setMaxWords} 
            disabled={status === "transcribing" || status === "uploading" || status === "downloading_model"}
          >
            <SelectTrigger className="bg-neutral-800 border-neutral-700 w-[180px]">
              <SelectValue placeholder="Default" />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-100">
              <SelectItem value="-1">Default (around 5 words)</SelectItem>
              <SelectItem value="-2">Short (2 to 3 words)</SelectItem>
              <SelectItem value="1">1 word exactly</SelectItem>
              <SelectItem value="2">2 words exactly</SelectItem>
              <SelectItem value="3">3 words exactly</SelectItem>
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
          className="mt-6 border border-neutral-700 bg-neutral-800/30 border-dashed rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-blue-500 hover:bg-neutral-800/50 transition-all duration-300 group"
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="video/*,audio/*"
          />
          <div className="flex items-center gap-3 truncate w-full">
            <div className="p-2 bg-neutral-800/50 rounded-lg border border-neutral-700 shrink-0 group-hover:scale-105 transition-transform">
              <Upload className="w-5 h-5 text-neutral-400 group-hover:text-blue-400 transition-colors" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-medium text-neutral-300 group-hover:text-blue-400 transition-colors truncate">Drag & Drop media here</p>
              <p className="text-xs text-neutral-500 mt-0.5 truncate">or click to browse files</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 border border-neutral-700 bg-neutral-800/50 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 truncate w-full">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg shrink-0">
              {file.type.startsWith('video') ? (
                <FileVideo className="w-5 h-5 text-blue-400" />
              ) : (
                <FileAudio className="w-5 h-5 text-blue-400" />
              )}
            </div>
            <div className="truncate flex-1">
              <p className="font-medium text-sm text-neutral-200 truncate">{file.name}</p>
              <p className="text-xs text-neutral-500 mt-0.5 truncate">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
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
      {(status === "uploading" || status === "transcribing" || status === "downloading_model" || status === "burning") && (
        <div className="space-y-3 pt-4 border-t border-neutral-800">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-neutral-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              {status === "uploading" ? (result ? "Re-uploading Media..." : "Uploading Media...") : 
               status === "downloading_model" ? `Downloading Model (${progress}%)` : 
               status === "burning" ? "Burning Subtitles into Video..." :
               (result ? (transcriptionMessage || "").replace("Transcribing", "Retranscribing") : transcriptionMessage)}
            </span>
            <div className="flex items-center gap-3">
              {status !== "transcribing" && status !== "burning" && (
                <span className="text-neutral-400 font-mono">{progress}%</span>
              )}
              {status !== "burning" && (
                <Button variant="ghost" size="sm" onClick={cancelTranscription} className="h-6 px-2 text-xs text-neutral-400 hover:text-white border border-neutral-700">Cancel</Button>
              )}
            </div>
          </div>
          {status === "transcribing" || status === "burning" ? (
            <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden relative">
              <div className="absolute inset-0 bg-primary/20" />
              <div className="h-full bg-primary w-1/2 rounded-full animate-[progress_1.5s_ease-in-out_infinite] absolute left-0" />
            </div>
          ) : (
            <Progress value={progress} className="h-2 bg-neutral-800" />
          )}
        </div>
      )}

      <div className="pt-4 flex flex-col gap-3">
        <div className="flex gap-3">
          {(status === "idle" || status === "error") && (
            <>
              <Button 
                onClick={handleTranscribe} 
                disabled={!file} 
                className="flex-1 font-semibold shadow-md transition-all duration-300"
              >
                Start Transcription
              </Button>
              {file && status === "idle" && (
                <Button onClick={clearProject} variant="outline" className="font-semibold shadow-md transition-all duration-300 border-red-900/30 text-red-400 hover:text-red-300 hover:bg-red-950/30">
                  Start Over
                </Button>
              )}
            </>
          )}
          
          {status === "done" && (
            <>
              {result && result.raw_segments && (
                <Button 
                  onClick={handleResegment} 
                  className="flex-1 font-semibold shadow-md transition-all duration-300"
                >
                  Re-segment
                </Button>
              )}
              <Button 
                onClick={handleTranscribe} 
                variant={result && result.raw_segments ? "secondary" : "default"}
                className="flex-1 font-semibold shadow-md transition-all duration-300"
              >
                Re-transcribe
              </Button>
              <Button onClick={clearProject} variant="outline" className="font-semibold shadow-md transition-all duration-300 border-red-900/30 text-red-400 hover:text-red-300 hover:bg-red-950/30">
                Start Over
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

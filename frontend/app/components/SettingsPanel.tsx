import { Upload, FileAudio, FileVideo, Settings, CloudDownload, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HexColorPicker } from "react-colorful";
import type { SubtitleStyle } from "../page";

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
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleTranscribe: () => void;
  downloadedModels: Record<string, boolean>;
  cancelTranscription: () => void;
  handleResegment: () => void;
  result: any;
  transcriptionMessage: string;
  clearProject: () => void;
  subtitleStyle: SubtitleStyle;
  setSubtitleStyle: React.Dispatch<React.SetStateAction<SubtitleStyle>>;
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
  cancelTranscription,
  handleResegment,
  result,
  transcriptionMessage,
  clearProject,
  subtitleStyle,
  setSubtitleStyle,
}: SettingsPanelProps) {
  
  const updateStyle = (key: keyof SubtitleStyle, value: any) => {
    setSubtitleStyle(prev => ({ ...prev, [key]: value }));
  };

  const ColorPickerField = ({ label, colorKey, enabledKey }: { label: string, colorKey: keyof SubtitleStyle, enabledKey?: keyof SubtitleStyle }) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {enabledKey && (
          <Switch 
            checked={subtitleStyle[enabledKey] as boolean} 
            onCheckedChange={(val) => updateStyle(enabledKey, val)} 
          />
        )}
        <Label className="text-neutral-300">{label}</Label>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <div className="w-8 h-8 rounded border border-neutral-700 cursor-pointer shadow-sm" style={{ backgroundColor: subtitleStyle[colorKey] as string }} />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3 bg-neutral-900 border-neutral-800 shadow-xl" side="left">
          <HexColorPicker color={subtitleStyle[colorKey] as string} onChange={(val) => updateStyle(colorKey, val)} />
          <div className="mt-3 flex items-center gap-2">
            <span className="text-neutral-400 text-xs font-mono">#</span>
            <input 
              type="text" 
              value={(subtitleStyle[colorKey] as string).replace('#', '')}
              onChange={(e) => updateStyle(colorKey, `#${e.target.value}`)}
              className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-sm font-mono text-neutral-200 w-full"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

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
    <Card className="w-full h-full flex flex-col bg-neutral-900 border-neutral-800 shadow-2xl p-0 gap-0">
      <Tabs defaultValue="settings" className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-neutral-800 shrink-0">
          <TabsList className="grid w-full grid-cols-2 bg-neutral-950">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="style">Style</TabsTrigger>
          </TabsList>
        </div>
        
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-800 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-700">
          <TabsContent value="settings" className="p-6 m-0 space-y-6">
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
        {(status === "uploading" || status === "transcribing" || status === "downloading_model") && (
          <div className="space-y-3 pt-4 border-t border-neutral-800">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-neutral-300 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                {status === "uploading" ? "Uploading Media..." : 
                 status === "downloading_model" ? `Downloading Model (${progress}%)` : 
                 transcriptionMessage}
              </span>
              {status !== "transcribing" && (
                <span className="text-neutral-400 font-mono">{progress}%</span>
              )}
            </div>
            {status === "transcribing" ? (
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden relative">
                <div className="absolute inset-0 bg-primary/20" />
                <div className="h-full bg-primary w-1/2 rounded-full animate-[progress_1.5s_ease-in-out_infinite] absolute left-0" />
              </div>
            ) : (
              <Progress value={progress} className="h-2 bg-neutral-800" />
            )}
          </div>
        )}

            {/* Actions for Settings Tab */}
            <div className="pt-4 flex gap-3">
              {(status === "uploading" || status === "transcribing" || status === "downloading_model") && (
                <div className="flex items-center gap-3 w-full bg-neutral-800/50 border border-neutral-700 p-3 rounded-lg">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  <p className="text-sm font-medium text-blue-400 flex-1">{transcriptionMessage}</p>
                  <Button variant="ghost" size="sm" onClick={cancelTranscription} className="text-neutral-400 hover:text-white">Cancel</Button>
                </div>
              )}
              
              {(status === "idle" || status === "error") && (
                <>
                  <Button 
                    onClick={handleTranscribe} 
                    disabled={!file || status === "uploading" || status === "transcribing" || status === "downloading_model"} 
                    className="flex-1 font-semibold shadow-md transition-all duration-300"
                  >
                    {status === "uploading" || status === "transcribing" || status === "downloading_model" ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing Media</>
                    ) : (
                      "Start Transcription"
                    )}
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
          </TabsContent>

          <TabsContent value="style" className="p-6 m-0 space-y-8">
            <div className="space-y-4">
              <h3 className="font-semibold text-neutral-200">Typography</h3>
              
              <div className="space-y-2">
                <Label className="text-neutral-300">Font Family</Label>
                <Select value={subtitleStyle.fontFamily} onValueChange={(v) => updateStyle("fontFamily", v)}>
                  <SelectTrigger className="bg-neutral-800 border-neutral-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-100">
                    <SelectItem value="Inter">Inter</SelectItem>
                    <SelectItem value="Roboto">Roboto</SelectItem>
                    <SelectItem value="Outfit">Outfit</SelectItem>
                    <SelectItem value="Montserrat">Montserrat</SelectItem>
                    <SelectItem value="Impact">Impact</SelectItem>
                    <SelectItem value="Arial">Arial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-neutral-300">Font Weight</Label>
                <Select value={subtitleStyle.fontWeight} onValueChange={(v) => updateStyle("fontWeight", v)}>
                  <SelectTrigger className="bg-neutral-800 border-neutral-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-100">
                    <SelectItem value="400">Regular (400)</SelectItem>
                    <SelectItem value="600">Semi-Bold (600)</SelectItem>
                    <SelectItem value="800">Extra Bold (800)</SelectItem>
                    <SelectItem value="900">Black (900)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label className="text-neutral-300">Font Size</Label>
                  <span className="text-xs text-neutral-500 font-mono">{subtitleStyle.fontSize}px</span>
                </div>
                <Slider 
                  value={[subtitleStyle.fontSize]} 
                  min={12} max={120} step={1}
                  onValueChange={([v]) => updateStyle("fontSize", v)} 
                />
              </div>

              <ColorPickerField label="Text Color" colorKey="textColor" />
            </div>

            <div className="space-y-4 pt-4 border-t border-neutral-800">
              <h3 className="font-semibold text-neutral-200">Stroke / Outline</h3>
              <ColorPickerField label="Enable Stroke" colorKey="strokeColor" enabledKey="strokeEnabled" />
              <div className={`space-y-3 transition-opacity ${subtitleStyle.strokeEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div className="flex justify-between">
                  <Label className="text-neutral-400 text-xs">Stroke Width</Label>
                  <span className="text-xs text-neutral-500 font-mono">{subtitleStyle.strokeWidth}px</span>
                </div>
                <Slider 
                  value={[subtitleStyle.strokeWidth]} 
                  min={0} max={20} step={0.5}
                  onValueChange={([v]) => updateStyle("strokeWidth", v)} 
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-neutral-800">
              <h3 className="font-semibold text-neutral-200">Shadow</h3>
              <ColorPickerField label="Enable Shadow" colorKey="shadowColor" enabledKey="shadowEnabled" />
              <div className={`space-y-4 transition-opacity ${subtitleStyle.shadowEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label className="text-neutral-400 text-xs">Blur Radius</Label>
                    <span className="text-xs text-neutral-500 font-mono">{subtitleStyle.shadowBlur}px</span>
                  </div>
                  <Slider 
                    value={[subtitleStyle.shadowBlur]} 
                    min={0} max={50} step={1}
                    onValueChange={([v]) => updateStyle("shadowBlur", v)} 
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label className="text-neutral-400 text-xs">Y Offset</Label>
                    <span className="text-xs text-neutral-500 font-mono">{subtitleStyle.shadowOffsetY}px</span>
                  </div>
                  <Slider 
                    value={[subtitleStyle.shadowOffsetY]} 
                    min={-20} max={20} step={1}
                    onValueChange={([v]) => updateStyle("shadowOffsetY", v)} 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-neutral-800">
              <h3 className="font-semibold text-neutral-200">Background Highlight</h3>
              <ColorPickerField label="Enable Background" colorKey="backgroundColor" enabledKey="backgroundEnabled" />
              <div className={`space-y-3 transition-opacity ${subtitleStyle.backgroundEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div className="flex justify-between">
                  <Label className="text-neutral-400 text-xs">Opacity</Label>
                  <span className="text-xs text-neutral-500 font-mono">{subtitleStyle.backgroundOpacity}%</span>
                </div>
                <Slider 
                  value={[subtitleStyle.backgroundOpacity]} 
                  min={0} max={100} step={1}
                  onValueChange={([v]) => updateStyle("backgroundOpacity", v)} 
                />
              </div>
            </div>

          </TabsContent>
        </div>
      </Tabs>
    </Card>
  );
}

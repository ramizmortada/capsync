import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SubtitleStyle, StylePreset } from "../types";
import { SavePresetDialog } from "./settings/SavePresetDialog";
import { SettingsTab } from "./settings/SettingsTab";
import { StyleTab } from "./settings/StyleTab";
import { AnimationTab } from "./settings/AnimationTab";

interface SettingsPanelProps {
  file: File | null;
  setFile: (file: File | null) => void;
  status: "idle" | "uploading" | "downloading_model" | "transcribing" | "burning" | "done" | "error";
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
  handleExportVideo: () => void;
  presets: StylePreset[];
  activePresetId: string;
  onSavePreset: (name: string) => void;
  onDeletePreset: (presetId: string) => void;
  onApplyPreset: (presetId: string) => void;
  onUpdatePreset: (presetId: string) => void;
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
  presets,
  activePresetId,
  onSavePreset,
  onDeletePreset,
  onApplyPreset,
  onUpdatePreset,
}: SettingsPanelProps) {
  
  const [activeTab, setActiveTab] = useState("settings");

  const activePreset = presets.find(p => p.id === activePresetId);
  const isCustomPreset = activePreset && !activePreset.isDefault && activePreset.id !== 'custom';

  useEffect(() => {
    const savedTab = localStorage.getItem("capsync_active_tab");
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    localStorage.setItem("capsync_active_tab", val);
  };

  const updateStyle = (key: keyof SubtitleStyle, value: any) => {
    setSubtitleStyle(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="w-full h-full flex flex-col bg-card border-border shadow-2xl p-0 gap-0">
      {/* Preset Selector Area */}
      <div className="p-4 border-b border-border shrink-0 space-y-2 bg-muted/20">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Style & Settings Preset</span>
          {isCustomPreset && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-destructive hover:text-destructive hover:bg-destructive/10 p-0"
              onClick={() => onDeletePreset(activePresetId)}
              title="Delete current custom preset"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={activePresetId} onValueChange={onApplyPreset}>
            <SelectTrigger className="bg-background border-input flex-1 text-xs text-foreground h-9">
              <SelectValue placeholder="Select preset..." />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-foreground">
              {presets.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
              {activePresetId === "custom" && (
                <SelectItem value="custom" className="text-xs italic" disabled>
                  Custom Preset
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          
          <SavePresetDialog
            presets={presets}
            activePresetId={activePresetId}
            onSavePreset={onSavePreset}
            onUpdatePreset={onUpdatePreset}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-neutral-800 shrink-0">
          <TabsList className="grid w-full grid-cols-3 bg-neutral-950">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="style">Style</TabsTrigger>
            <TabsTrigger value="animation">Animation</TabsTrigger>
          </TabsList>
        </div>
        
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-800 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-700">
          <TabsContent value="settings" className="m-0">
            <SettingsTab
              status={status}
              modelSize={modelSize}
              setModelSize={setModelSize}
              language={language}
              setLanguage={setLanguage}
              maxWords={maxWords}
              setMaxWords={setMaxWords}
              downloadedModels={downloadedModels}
              file={file}
              setFile={setFile}
              handleFileChange={handleFileChange}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              fileInputRef={fileInputRef}
              transcriptionMessage={transcriptionMessage}
              progress={progress}
              cancelTranscription={cancelTranscription}
              handleTranscribe={handleTranscribe}
              handleResegment={handleResegment}
              clearProject={clearProject}
              result={result}
            />
          </TabsContent>

          <TabsContent value="style" className="m-0">
            <StyleTab 
              subtitleStyle={subtitleStyle}
              updateStyle={updateStyle}
            />
          </TabsContent>

          <TabsContent value="animation" className="m-0">
            <AnimationTab
              subtitleStyle={subtitleStyle}
              updateStyle={updateStyle}
            />
          </TabsContent>
        </div>
      </Tabs>
    </Card>
  );
}

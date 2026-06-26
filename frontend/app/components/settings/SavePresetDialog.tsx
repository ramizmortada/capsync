import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StylePreset } from "../../types";

interface SavePresetDialogProps {
  presets: StylePreset[];
  activePresetId: string;
  onSavePreset: (name: string) => void;
  onUpdatePreset: (presetId: string) => void;
}

export const SavePresetDialog = ({
  presets,
  activePresetId,
  onSavePreset,
  onUpdatePreset,
}: SavePresetDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<'new' | 'overwrite'>('new');
  const [newPresetName, setNewPresetName] = useState("");
  const [overwritePresetId, setOverwritePresetId] = useState("");

  const activePreset = presets.find(p => p.id === activePresetId);
  const isCustomPreset = activePreset && !activePreset.isDefault && activePreset.id !== 'custom';
  const customPresets = presets.filter(p => !p.isDefault && p.id !== 'custom');

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setNewPresetName("");
      if (isCustomPreset) {
        setSaveMode('overwrite');
        setOverwritePresetId(activePresetId);
      } else {
        setSaveMode('new');
        if (customPresets.length > 0) {
          setOverwritePresetId(customPresets[0].id);
        } else {
          setOverwritePresetId("");
        }
      }
    }
  };

  const handleSaveSubmit = () => {
    if (newPresetName.trim()) {
      onSavePreset(newPresetName.trim());
      setNewPresetName("");
      setIsOpen(false);
    }
  };

  const handleOverwritePreset = () => {
    if (overwritePresetId) {
      onUpdatePreset(overwritePresetId);
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 px-2 text-xs border-input text-muted-foreground hover:text-foreground flex items-center gap-1.5 shrink-0"
          title="Save current custom style & settings"
        >
          <Save className="w-3.5 h-3.5" /> Save
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-popover border-border p-6 rounded-lg text-foreground">
        <DialogHeader>
          <DialogTitle>Save Custom Preset</DialogTitle>
          <DialogDescription>
            Save your current style, model, and word limits settings.
          </DialogDescription>
        </DialogHeader>
        
        {customPresets.length > 0 && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg mt-4">
            <button
              type="button"
              onClick={() => setSaveMode('new')}
              className={`py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${saveMode === 'new' ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Save as New
            </button>
            <button
              type="button"
              onClick={() => setSaveMode('overwrite')}
              className={`py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${saveMode === 'overwrite' ? 'bg-background text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Overwrite Existing
            </button>
          </div>
        )}

        <div className="mt-4 min-h-[76px]">
          {saveMode === 'new' ? (
            <div className="space-y-1.5">
              <Label htmlFor="preset-name" className="text-muted-foreground text-xs font-medium">Preset Name</Label>
              <input
                id="preset-name"
                type="text"
                placeholder="e.g. My Fast Reels"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring w-full h-9"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newPresetName.trim()) {
                    handleSaveSubmit();
                  }
                }}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-medium">Select Preset to Overwrite</Label>
              <Select value={overwritePresetId} onValueChange={setOverwritePresetId}>
                <SelectTrigger className="bg-background border-input w-full text-xs text-foreground h-9">
                  <SelectValue placeholder="Select preset to overwrite..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground">
                  {customPresets.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 mt-6 w-full">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsOpen(false)} 
            className="h-9 text-xs font-semibold w-full cursor-pointer"
          >
            Cancel
          </Button>
          <Button 
            onClick={saveMode === 'new' ? handleSaveSubmit : handleOverwritePreset} 
            disabled={saveMode === 'new' ? !newPresetName.trim() : !overwritePresetId}
            size="sm"
            className="h-9 text-xs font-semibold w-full cursor-pointer"
          >
            {saveMode === 'new' ? 'Save Preset' : 'Overwrite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import { useState, useEffect, useCallback } from "react";
import { SubtitleStyle, StylePreset, DEFAULT_PRESETS } from "../app/types";

export function usePresets(
  subtitleStyle: SubtitleStyle,
  setSubtitleStyle: React.Dispatch<React.SetStateAction<SubtitleStyle>>,
  modelSize: string,
  setModelSize: (s: string) => void,
  maxWords: string,
  setMaxWords: (w: string) => void
) {
  const [presets, setPresets] = useState<StylePreset[]>(DEFAULT_PRESETS);
  const [activePresetId, setActivePresetId] = useState<string>("default-studio");

  const markCustom = useCallback(() => {
    setActivePresetId("custom");
    localStorage.setItem("capsync_active_preset_id", "custom");
  }, []);

  const handleModelSizeChange = useCallback((size: string) => {
    setModelSize(size);
    markCustom();
  }, [setModelSize, markCustom]);

  const handleMaxWordsChange = useCallback((words: string) => {
    setMaxWords(words);
    markCustom();
  }, [setMaxWords, markCustom]);

  const handleSubtitleStyleChange = useCallback((updater: React.SetStateAction<SubtitleStyle>) => {
    setSubtitleStyle(updater);
    markCustom();
  }, [setSubtitleStyle, markCustom]);

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

  return {
    presets,
    activePresetId,
    handleModelSizeChange,
    handleMaxWordsChange,
    handleSubtitleStyleChange,
    savePreset,
    deletePreset,
    applyPreset,
    updatePreset,
  };
}

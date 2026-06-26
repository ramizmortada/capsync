import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HexColorPicker } from "react-colorful";
import type { SubtitleStyle } from "../../types";

interface ColorPickerFieldProps {
  label: string;
  colorKey: keyof SubtitleStyle;
  enabledKey?: keyof SubtitleStyle;
  subtitleStyle: SubtitleStyle;
  updateStyle: (key: keyof SubtitleStyle, value: any) => void;
}

export const ColorPickerField = ({ 
  label, 
  colorKey, 
  enabledKey, 
  subtitleStyle, 
  updateStyle 
}: ColorPickerFieldProps) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      {enabledKey && (
        <Switch 
          checked={subtitleStyle[enabledKey] as boolean} 
          onCheckedChange={(val) => updateStyle(enabledKey, val)} 
        />
      )}
      <Label className="text-muted-foreground">{label}</Label>
    </div>
    <Popover>
      <PopoverTrigger asChild>
        <div className="w-8 h-8 rounded border border-input cursor-pointer shadow-sm" style={{ backgroundColor: (subtitleStyle[colorKey] as string) || '#ffffff' }} />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 bg-popover border-border shadow-xl" side="left">
        <HexColorPicker color={(subtitleStyle[colorKey] as string) || '#ffffff'} onChange={(val) => updateStyle(colorKey, val)} />
        <div className="mt-3 flex items-center gap-2">
          <span className="text-muted-foreground text-xs font-mono">#</span>
          <input 
            type="text" 
            value={((subtitleStyle[colorKey] as string) || '#ffffff').replace('#', '')}
            onChange={(e) => updateStyle(colorKey, `#${e.target.value}`)}
            className="bg-background border border-input rounded px-2 py-1 text-sm font-mono text-foreground w-full"
          />
        </div>
      </PopoverContent>
    </Popover>
  </div>
);

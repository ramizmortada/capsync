import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { SubtitleStyle } from "../../types";
import { ColorPickerField } from "./ColorPickerField";

interface AnimationTabProps {
  subtitleStyle: SubtitleStyle;
  updateStyle: (key: keyof SubtitleStyle, value: any) => void;
}

export const AnimationTab = ({ subtitleStyle, updateStyle }: AnimationTabProps) => {
  return (
    <div className="p-6 m-0 space-y-8">
      <div className="space-y-4">
        <h3 className="font-semibold text-neutral-200">Segment Appearance</h3>
        <div className="flex items-center justify-between">
          <Label className="text-neutral-300">Animation In</Label>
          <Select value={subtitleStyle.animationIn || 'none'} onValueChange={(v) => updateStyle("animationIn", v)}>
            <SelectTrigger className="bg-neutral-800 border-neutral-700 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-100">
              <SelectItem value="none">None (Instant)</SelectItem>
              <SelectItem value="fade">Fade In</SelectItem>
              <SelectItem value="zoomIn">Zoom In</SelectItem>
              <SelectItem value="zoomOut">Zoom Out</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-neutral-300">Animation Out</Label>
          <Select value={subtitleStyle.animationOut || 'none'} onValueChange={(v) => updateStyle("animationOut", v)}>
            <SelectTrigger className="bg-neutral-800 border-neutral-700 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-100">
              <SelectItem value="none">None (Instant)</SelectItem>
              <SelectItem value="fade">Fade Out</SelectItem>
              <SelectItem value="zoomIn">Zoom In</SelectItem>
              <SelectItem value="zoomOut">Zoom Out</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-neutral-800">
        <h3 className="font-semibold text-neutral-200">Word Highlighting</h3>
        <div className="flex items-center justify-between">
          <Label className="text-neutral-300">Highlighting Style</Label>
          <Select value={subtitleStyle.animationStyle || 'color'} onValueChange={(v) => updateStyle("animationStyle", v)}>
            <SelectTrigger className="bg-neutral-800 border-neutral-700 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-100">
              <SelectItem value="none">None (Static Text)</SelectItem>
              <SelectItem value="color">Color Pop</SelectItem>
              <SelectItem value="box">Box Highlight</SelectItem>
              <SelectItem value="scale">Scale Pop</SelectItem>
              <SelectItem value="karaoke">Karaoke Reveal</SelectItem>
              <SelectItem value="reveal">Word Reveal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {subtitleStyle.animationStyle !== 'none' && (
        <div className="space-y-4 pt-4 border-t border-neutral-800">
          <h3 className="font-semibold text-neutral-200">Preset Settings</h3>
          
          {(subtitleStyle.animationStyle === 'color' || subtitleStyle.animationStyle === 'karaoke' || subtitleStyle.animationStyle === 'scale') && (
            <ColorPickerField label="Highlight Text Color" colorKey="highlightColor" subtitleStyle={subtitleStyle} updateStyle={updateStyle} />
          )}

          {subtitleStyle.animationStyle === 'box' && (
            <ColorPickerField label="Highlight Box Color" colorKey="highlightBackgroundColor" subtitleStyle={subtitleStyle} updateStyle={updateStyle} />
          )}

          {subtitleStyle.animationStyle === 'scale' && (
            <div className="space-y-3 pt-2">
              <div className="flex justify-between">
                <Label className="text-neutral-300">Scale Factor</Label>
                <span className="text-xs text-neutral-500 font-mono">x{subtitleStyle.scaleFactor ?? 1.2}</span>
              </div>
              <Slider 
                value={[subtitleStyle.scaleFactor ?? 1.2]} 
                min={1.0} max={2.0} step={0.05}
                onValueChange={([v]) => updateStyle("scaleFactor", v)} 
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import { AlignLeft, AlignCenter, AlignRight, ArrowUp, Minus, ArrowDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SubtitleStyle } from "../../types";
import { FONT_WEIGHTS } from "./constants";
import { ColorPickerField } from "./ColorPickerField";

interface StyleTabProps {
  subtitleStyle: SubtitleStyle;
  updateStyle: (key: keyof SubtitleStyle, value: any) => void;
}

export const StyleTab = ({ subtitleStyle, updateStyle }: StyleTabProps) => {
  return (
    <div className="p-6 m-0 space-y-8">
      <div className="space-y-4">
        <h3 className="font-semibold text-neutral-200">Layout & Position</h3>
        
        <div className="space-y-3">
          <Label className="text-muted-foreground">Text Alignment</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className={`border-input ${subtitleStyle.alignment === 'left' ? 'text-white font-medium' : 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
              style={subtitleStyle.alignment === 'left' ? { backgroundColor: 'color-mix(in srgb, var(--accent-blue) 30%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-blue) 50%, transparent)' } : undefined}
              onClick={() => updateStyle("alignment", "left")}
            ><AlignLeft className="w-4 h-4" /></Button>
            <Button 
              variant="outline" 
              size="sm" 
              className={`border-input ${subtitleStyle.alignment === 'center' ? 'text-white font-medium' : 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
              style={subtitleStyle.alignment === 'center' ? { backgroundColor: 'color-mix(in srgb, var(--accent-blue) 30%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-blue) 50%, transparent)' } : undefined}
              onClick={() => updateStyle("alignment", "center")}
            ><AlignCenter className="w-4 h-4" /></Button>
            <Button 
              variant="outline" 
              size="sm" 
              className={`border-input ${subtitleStyle.alignment === 'right' ? 'text-white font-medium' : 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
              style={subtitleStyle.alignment === 'right' ? { backgroundColor: 'color-mix(in srgb, var(--accent-blue) 30%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-blue) 50%, transparent)' } : undefined}
              onClick={() => updateStyle("alignment", "right")}
            ><AlignRight className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-muted-foreground">Vertical Alignment</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className={`border-input ${subtitleStyle.alignmentVertical === 'top' ? 'text-white font-medium' : 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
              style={subtitleStyle.alignmentVertical === 'top' ? { backgroundColor: 'color-mix(in srgb, var(--accent-blue) 30%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-blue) 50%, transparent)' } : undefined}
              onClick={() => updateStyle("alignmentVertical", "top")}
            ><ArrowUp className="w-4 h-4" /></Button>
            <Button 
              variant="outline" 
              size="sm" 
              className={`border-input ${subtitleStyle.alignmentVertical === 'middle' ? 'text-white font-medium' : 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
              style={subtitleStyle.alignmentVertical === 'middle' ? { backgroundColor: 'color-mix(in srgb, var(--accent-blue) 30%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-blue) 50%, transparent)' } : undefined}
              onClick={() => updateStyle("alignmentVertical", "middle")}
            ><Minus className="w-4 h-4" /></Button>
            <Button 
              variant="outline" 
              size="sm" 
              className={`border-input ${subtitleStyle.alignmentVertical === 'bottom' || !subtitleStyle.alignmentVertical ? 'text-white font-medium' : 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
              style={subtitleStyle.alignmentVertical === 'bottom' || !subtitleStyle.alignmentVertical ? { backgroundColor: 'color-mix(in srgb, var(--accent-blue) 30%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-blue) 50%, transparent)' } : undefined}
              onClick={() => updateStyle("alignmentVertical", "bottom")}
            ><ArrowDown className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex justify-between">
            <Label className="text-neutral-300">Vertical Margin</Label>
            <span className="text-xs text-neutral-500 font-mono">{subtitleStyle.positionY ?? 10}%</span>
          </div>
          <Slider 
            value={[subtitleStyle.positionY ?? 10]} 
            min={0} max={100} step={1}
            onValueChange={([v]) => updateStyle("positionY", v)} 
          />
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex justify-between">
            <Label className="text-neutral-300">Max Width</Label>
            <span className="text-xs text-neutral-500 font-mono">{subtitleStyle.maxWidth ?? 90}%</span>
          </div>
          <Slider 
            value={[subtitleStyle.maxWidth ?? 90]} 
            min={20} max={100} step={1}
            onValueChange={([v]) => updateStyle("maxWidth", v)} 
          />
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-neutral-800">
        <h3 className="font-semibold text-neutral-200">Typography</h3>
        
        <div className="flex items-center justify-between">
          <Label className="text-neutral-300">Font Family</Label>
          <Select 
            value={subtitleStyle.fontFamily} 
            onValueChange={(v) => {
              updateStyle("fontFamily", v);
              const available = FONT_WEIGHTS[v] || FONT_WEIGHTS["Inter"];
              if (!available.some(w => w.value === subtitleStyle.fontWeight)) {
                updateStyle("fontWeight", "400");
              }
            }}
          >
            <SelectTrigger className="bg-neutral-800 border-neutral-700 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-100">
              <SelectItem value="Inter">Inter</SelectItem>
              <SelectItem value="Instrument Serif">Instrument Serif</SelectItem>
              <SelectItem value="Poppins">Poppins</SelectItem>
              <SelectItem value="Oswald">Oswald</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-neutral-300">Font Weight</Label>
          <Select value={subtitleStyle.fontWeight} onValueChange={(v) => updateStyle("fontWeight", v)}>
            <SelectTrigger className="bg-neutral-800 border-neutral-700 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-100">
              {(FONT_WEIGHTS[subtitleStyle.fontFamily] || FONT_WEIGHTS["Inter"]).map(weight => (
                <SelectItem key={weight.value} value={weight.value}>{weight.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-neutral-300">Text Transform</Label>
          <Select value={subtitleStyle.textTransform || 'none'} onValueChange={(v: any) => updateStyle("textTransform", v)}>
            <SelectTrigger className="bg-neutral-800 border-neutral-700 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-100">
              <SelectItem value="none">Normal (None)</SelectItem>
              <SelectItem value="uppercase">UPPERCASE</SelectItem>
              <SelectItem value="lowercase">lowercase</SelectItem>
              <SelectItem value="capitalize">Capitalize (Title Case)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between">
            <Label className="text-neutral-300">Font Size</Label>
            <span className="text-xs text-neutral-500 font-mono">{Number(subtitleStyle.fontSize).toFixed(0)}px</span>
          </div>
          <Slider 
            value={[subtitleStyle.fontSize]} 
            min={28} max={164} step={1}
            onValueChange={([v]) => updateStyle("fontSize", v)} 
          />
        </div>

        <ColorPickerField label="Text Color" colorKey="textColor" subtitleStyle={subtitleStyle} updateStyle={updateStyle} />
      </div>

      <div className="space-y-4 pt-4 border-t border-neutral-800">
        <h3 className="font-semibold text-neutral-200">Stroke / Outline</h3>
        <ColorPickerField label="Enable Stroke" colorKey="strokeColor" enabledKey="strokeEnabled" subtitleStyle={subtitleStyle} updateStyle={updateStyle} />
        <div className={`space-y-3 transition-opacity ${subtitleStyle.strokeEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div className="flex justify-between">
            <Label className="text-neutral-300 text-xs">Width</Label>
            <span className="text-xs text-neutral-500 font-mono">{Number(subtitleStyle.strokeWidth).toFixed(0)}px</span>
          </div>
          <Slider 
            value={[subtitleStyle.strokeWidth]} 
            min={1} max={28} step={1}
            onValueChange={([v]) => updateStyle("strokeWidth", v)} 
          />
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-neutral-800">
        <h3 className="font-semibold text-neutral-200">Shadow</h3>
        <ColorPickerField label="Enable Shadow" colorKey="shadowColor" enabledKey="shadowEnabled" subtitleStyle={subtitleStyle} updateStyle={updateStyle} />
        <div className={`space-y-4 transition-opacity ${subtitleStyle.shadowEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label className="text-neutral-300 text-xs">Blur</Label>
              <span className="text-xs text-neutral-500 font-mono">{Number(subtitleStyle.shadowBlur).toFixed(0)}px</span>
            </div>
            <Slider 
              value={[subtitleStyle.shadowBlur]} 
              min={0} max={100} step={1}
              onValueChange={([v]) => updateStyle("shadowBlur", v)} 
            />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label className="text-neutral-300 text-xs">Offset X</Label>
              <span className="text-xs text-neutral-500 font-mono">{Number(subtitleStyle.shadowOffsetX).toFixed(0)}px</span>
            </div>
            <Slider 
              value={[subtitleStyle.shadowOffsetX]} 
              min={-50} max={50} step={1}
              onValueChange={([v]) => updateStyle("shadowOffsetX", v)} 
            />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label className="text-neutral-300 text-xs">Offset Y</Label>
              <span className="text-xs text-neutral-500 font-mono">{Number(subtitleStyle.shadowOffsetY).toFixed(0)}px</span>
            </div>
            <Slider 
              value={[subtitleStyle.shadowOffsetY]} 
              min={-50} max={50} step={1}
              onValueChange={([v]) => updateStyle("shadowOffsetY", v)} 
            />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
            <Label className="text-neutral-300 text-sm font-medium">Solid 3D Extrusion</Label>
            <Switch 
              checked={subtitleStyle.shadow3DEnabled ?? false} 
              onCheckedChange={(c) => updateStyle("shadow3DEnabled", c)} 
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-neutral-800">
        <h3 className="font-semibold text-neutral-200">Background Highlight</h3>
        <ColorPickerField label="Enable Background" colorKey="backgroundColor" enabledKey="backgroundEnabled" subtitleStyle={subtitleStyle} updateStyle={updateStyle} />
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
    </div>
  );
};

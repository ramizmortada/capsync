import React from 'react';
import { CanvasComposition, AspectRatioPreset } from '../../types/imageEditor';
import { SubtitleStyle, DEFAULT_PRESETS } from '../../types';
import { getTemplatesForFrameCount } from './LayoutTemplates';
import { Slider } from '@/components/ui/slider';
import { LayoutGrid, Maximize2, Palette, Type, Square, CheckSquare } from 'lucide-react';

interface PanelStyleControlsProps {
  canvas: CanvasComposition;
  frameCount: number;
  onUpdateCanvas: (updated: CanvasComposition) => void;
  onUpdateAllCanvases: (updater: (c: CanvasComposition) => CanvasComposition) => void;
  globalSubtitleStyle: SubtitleStyle;
  onUpdateGlobalSubtitleStyle: (style: SubtitleStyle) => void;
}

const FONT_FAMILIES = [
  'Inter',
  'Roboto',
  'Montserrat',
  'Oswald',
  'Poppins',
  'Impact',
  'Comic Sans MS',
  'Courier New',
  'Georgia',
];

const ASPECT_PRESETS: Array<{ id: AspectRatioPreset; label: string }> = [
  { id: 'auto', label: 'Auto (Video)' },
  { id: '1:1', label: '1:1 Square' },
  { id: '9:16', label: '9:16 Reel/Story' },
  { id: '16:9', label: '16:9 Landscape' },
  { id: '4:5', label: '4:5 Portrait' },
];

export function PanelStyleControls({
  canvas,
  frameCount,
  onUpdateCanvas,
  onUpdateAllCanvases,
  globalSubtitleStyle,
  onUpdateGlobalSubtitleStyle,
}: PanelStyleControlsProps) {
  const availableTemplates = getTemplatesForFrameCount(frameCount);

  // Effective subtitle style merging default, global, and active canvas style
  const style: SubtitleStyle = {
    ...DEFAULT_PRESETS[0].subtitleStyle,
    ...globalSubtitleStyle,
    ...(canvas.subtitleStyle || {}),
  };

  const handleUpdateSubtitleProp = (key: keyof SubtitleStyle, val: any) => {
    const updatedStyle: SubtitleStyle = {
      ...style,
      [key]: val,
    };

    onUpdateGlobalSubtitleStyle(updatedStyle);

    onUpdateAllCanvases((c) => ({
      ...c,
      subtitleStyle: updatedStyle,
    }));
  };

  return (
    <div className="w-80 min-w-[320px] border-l border-border bg-card/60 flex flex-col gap-4 p-4 overflow-y-auto shrink-0 select-none">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Palette className="w-4 h-4 text-purple-400" />
        <h2 className="font-bold text-sm text-foreground">Global Canvas & Panel Styling</h2>
      </div>

      {/* 1. Layout Templates Selection (Per-Canvas Template) */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
          <LayoutGrid className="w-3.5 h-3.5" /> Selected Composition Template ({frameCount} panels)
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {availableTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => onUpdateCanvas({ ...canvas, layoutId: template.id })}
              className={`px-2.5 py-1.5 text-xs rounded border text-left font-medium transition-all ${
                canvas.layoutId === template.id
                  ? 'border-purple-500 bg-purple-950/40 text-purple-200 shadow-sm'
                  : 'border-border bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              {template.name}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Aspect Ratio Presets (Applies to ALL Canvases) */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
          <Maximize2 className="w-3.5 h-3.5" /> Aspect Ratio (All Canvases)
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {ASPECT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onUpdateAllCanvases((c) => ({ ...c, aspectPreset: preset.id }))}
              className={`px-2 py-1.5 text-[11px] rounded border text-center font-medium transition-all ${
                canvas.aspectPreset === preset.id
                  ? 'border-purple-500 bg-purple-950/40 text-purple-200 shadow-sm'
                  : 'border-border bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Panel Border & Spacing Settings (Applies to ALL Canvases) */}
      <div className="flex flex-col gap-3 pt-2 border-t border-border">
        <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5" /> Border & Gap Styling (All Canvases)
        </label>

        {/* Single Border & Gap Width Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Border & Gap Width</span>
            <span className="font-mono text-purple-300">{canvas.borderWidth}px</span>
          </div>
          <Slider
            value={[canvas.borderWidth]}
            min={0}
            max={60}
            step={2}
            onValueChange={(val) => onUpdateAllCanvases((c) => ({ ...c, borderWidth: val[0], gap: val[0] }))}
          />
        </div>

        {/* Single Border & Background Color Picker */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Border & Background Color</span>
          <div className="flex items-center gap-2 bg-background border border-border p-1.5 rounded-lg">
            <input
              type="color"
              value={canvas.borderColor || canvas.backgroundColor || '#0f0f15'}
              onChange={(e) =>
                onUpdateAllCanvases((c) => ({
                  ...c,
                  borderColor: e.target.value,
                  backgroundColor: e.target.value,
                }))
              }
              className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
            />
            <span className="font-mono text-xs uppercase">{canvas.borderColor || canvas.backgroundColor || '#0f0f15'}</span>
          </div>
        </div>

        {/* Corner Radius */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Panel Corner Radius</span>
            <span className="font-mono text-purple-300">{canvas.borderRadius}px</span>
          </div>
          <Slider
            value={[canvas.borderRadius]}
            min={0}
            max={40}
            step={1}
            onValueChange={(val) => onUpdateAllCanvases((c) => ({ ...c, borderRadius: val[0] }))}
          />
        </div>
      </div>

      {/* 4. Subtitle Typography, Positioning & Wrapping Controls (Applies to ALL Canvases) */}
      <div className="flex flex-col gap-3 pt-2 border-t border-border">
        <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5" /> Caption Typography (All Canvases)
        </label>

        {/* Font Family */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Font Family</span>
          <select
            value={style.fontFamily || 'Inter'}
            onChange={(e) => handleUpdateSubtitleProp('fontFamily', e.target.value)}
            className="w-full h-8 text-xs bg-background border border-border rounded px-2 text-foreground"
          >
            {FONT_FAMILIES.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>

        {/* Text Capitalization / Case */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Text Capitalization</span>
          <select
            value={style.textTransform || 'none'}
            onChange={(e) => handleUpdateSubtitleProp('textTransform', e.target.value)}
            className="w-full h-8 text-xs bg-background border border-border rounded px-2 text-foreground"
          >
            <option value="none">Original (As Typed)</option>
            <option value="uppercase">ALL CAPS (UPPERCASE)</option>
            <option value="lowercase">all lowercase</option>
            <option value="capitalize">Capitalize Each Word (Title Case)</option>
            <option value="sentence">Sentence Case (First Letter)</option>
          </select>
        </div>

        {/* Font Size Scale */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Font Size</span>
            <span className="font-mono text-purple-300">{style.fontSize || 40}px</span>
          </div>
          <Slider
            value={[style.fontSize || 40]}
            min={18}
            max={100}
            step={2}
            onValueChange={(val) => handleUpdateSubtitleProp('fontSize', val[0])}
          />
        </div>

        {/* Text Vertical Alignment / Position Y */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Vertical Position (% Y)</span>
            <span className="font-mono text-purple-300">{style.positionY ?? 85}%</span>
          </div>
          <Slider
            value={[style.positionY ?? 85]}
            min={5}
            max={95}
            step={1}
            onValueChange={(val) => handleUpdateSubtitleProp('positionY', val[0])}
          />
        </div>

        {/* Max Text Width / Wrapping Margin */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Max Text Width (% Wrap)</span>
            <span className="font-mono text-purple-300">{style.maxWidth ?? 85}%</span>
          </div>
          <Slider
            value={[style.maxWidth ?? 85]}
            min={40}
            max={100}
            step={5}
            onValueChange={(val) => handleUpdateSubtitleProp('maxWidth', val[0])}
          />
        </div>

        {/* Text Color */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Text Color</span>
          <div className="flex items-center gap-2 bg-background border border-border p-1 rounded">
            <input
              type="color"
              value={style.textColor || '#ffffff'}
              onChange={(e) => handleUpdateSubtitleProp('textColor', e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
            />
            <span className="font-mono text-[10px] uppercase">
              {style.textColor || '#ffffff'}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Subtitle Background Box Controls */}
      <div className="flex flex-col gap-2.5 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-purple-300">Background Box</span>
          <button
            onClick={() => handleUpdateSubtitleProp('backgroundEnabled', !style.backgroundEnabled)}
            className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-xs"
          >
            {style.backgroundEnabled ? (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-purple-400" /> Enabled
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5 text-muted-foreground" /> Disabled
              </>
            )}
          </button>
        </div>

        {style.backgroundEnabled && (
          <div className="flex flex-col gap-2 bg-background/50 p-2.5 rounded-lg border border-border">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-muted-foreground">Box Color</span>
              <div className="flex items-center gap-2 bg-background border border-border p-1 rounded">
                <input
                  type="color"
                  value={style.backgroundColor || '#000000'}
                  onChange={(e) => handleUpdateSubtitleProp('backgroundColor', e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="font-mono text-[10px] uppercase">
                  {style.backgroundColor || '#000000'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Opacity</span>
                <span className="font-mono text-purple-300">{style.backgroundOpacity ?? 50}%</span>
              </div>
              <Slider
                value={[style.backgroundOpacity ?? 50]}
                min={0}
                max={100}
                step={5}
                onValueChange={(val) => handleUpdateSubtitleProp('backgroundOpacity', val[0])}
              />
            </div>
          </div>
        )}
      </div>

      {/* 6. Subtitle Text Outline / Stroke Controls */}
      <div className="flex flex-col gap-2.5 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-purple-300">Text Outline (Stroke)</span>
          <button
            onClick={() => handleUpdateSubtitleProp('strokeEnabled', !style.strokeEnabled)}
            className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-xs"
          >
            {style.strokeEnabled ? (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-purple-400" /> Enabled
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5 text-muted-foreground" /> Disabled
              </>
            )}
          </button>
        </div>

        {style.strokeEnabled && (
          <div className="flex flex-col gap-2 bg-background/50 p-2.5 rounded-lg border border-border">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-muted-foreground">Stroke Color</span>
              <div className="flex items-center gap-2 bg-background border border-border p-1 rounded">
                <input
                  type="color"
                  value={style.strokeColor || '#000000'}
                  onChange={(e) => handleUpdateSubtitleProp('strokeColor', e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="font-mono text-[10px] uppercase">
                  {style.strokeColor || '#000000'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Stroke Thickness</span>
                <span className="font-mono text-purple-300">{style.strokeWidth || 3}px</span>
              </div>
              <Slider
                value={[style.strokeWidth || 3]}
                min={1}
                max={15}
                step={1}
                onValueChange={(val) => handleUpdateSubtitleProp('strokeWidth', val[0])}
              />
            </div>
          </div>
        )}
      </div>

      {/* 7. Subtitle Text Shadow Controls */}
      <div className="flex flex-col gap-2.5 pt-2 border-t border-border pb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-purple-300">Text Shadow</span>
          <button
            onClick={() => handleUpdateSubtitleProp('shadowEnabled', !style.shadowEnabled)}
            className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-xs"
          >
            {style.shadowEnabled ? (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-purple-400" /> Enabled
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5 text-muted-foreground" /> Disabled
              </>
            )}
          </button>
        </div>

        {style.shadowEnabled && (
          <div className="flex flex-col gap-2 bg-background/50 p-2.5 rounded-lg border border-border">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-muted-foreground">Shadow Color</span>
              <div className="flex items-center gap-2 bg-background border border-border p-1 rounded">
                <input
                  type="color"
                  value={style.shadowColor || '#000000'}
                  onChange={(e) => handleUpdateSubtitleProp('shadowColor', e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="font-mono text-[10px] uppercase">
                  {style.shadowColor || '#000000'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Shadow Blur</span>
                <span className="font-mono text-purple-300">{style.shadowBlur || 6}px</span>
              </div>
              <Slider
                value={[style.shadowBlur || 6]}
                min={0}
                max={25}
                step={1}
                onValueChange={(val) => handleUpdateSubtitleProp('shadowBlur', val[0])}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

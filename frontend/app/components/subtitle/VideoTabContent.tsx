import { Settings, Video, Minus, Plus, Scissors, Blend, ArrowDown, ArrowUp, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";

interface VideoTabContentProps {
  videoCanvas?: any;
  setVideoCanvas?: any;
  selectedVideoIndexes?: string[];
  selectedTargetIds: string[];
  activeVideoSeg: any;
  setVideoSegments?: any;
}

export function VideoTabContent({
  videoCanvas,
  setVideoCanvas,
  selectedVideoIndexes,
  selectedTargetIds,
  activeVideoSeg,
  setVideoSegments,
}: VideoTabContentProps) {
  return (
    <ScrollArea className="flex-1 h-0 bg-background/50 p-6">
      <div className="flex flex-col gap-8 max-w-lg mx-auto">
        {/* Canvas Settings */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Settings className="w-4 h-4 text-purple-500" /> Canvas Settings
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Aspect Ratio</label>
              <select 
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-purple-500"
                value={videoCanvas?.type || 'auto'}
                onChange={(e) => {
                  const type = e.target.value;
                  if (type === '16:9') setVideoCanvas?.({ ...videoCanvas, type, width: 1920, height: 1080 });
                  else if (type === '9:16') setVideoCanvas?.({ ...videoCanvas, type, width: 1080, height: 1920 });
                  else if (type === '1:1') setVideoCanvas?.({ ...videoCanvas, type, width: 1080, height: 1080 });
                  else setVideoCanvas?.({ ...videoCanvas, type: 'auto' });
                }}
              >
                <option value="auto">Original (Auto)</option>
                <option value="16:9">YouTube (16:9)</option>
                <option value="9:16">Shorts / TikTok (9:16)</option>
                <option value="1:1">Square (1:1)</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Background Color</label>
              <div className="flex gap-2 items-center">
                <input 
                  type="color" 
                  className="w-8 h-8 rounded border-0 p-0 cursor-pointer bg-transparent"
                  value={videoCanvas?.backgroundColor || '#000000'}
                  onChange={(e) => setVideoCanvas?.({ ...videoCanvas, backgroundColor: e.target.value })}
                />
                <input 
                  type="text" 
                  className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none uppercase font-mono"
                  value={videoCanvas?.backgroundColor || '#000000'}
                  onChange={(e) => setVideoCanvas?.({ ...videoCanvas, backgroundColor: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Transform Settings */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Video className="w-4 h-4 text-purple-500" /> Video Clip Transform & Mask
            </h3>
            <span className="text-xs font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30 inline-block">
              {selectedVideoIndexes && selectedVideoIndexes.length > 0 ? `${selectedVideoIndexes.length} selected` : 'All Clips'}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-6 bg-card border border-border rounded-lg p-5">
            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium text-muted-foreground flex justify-between">
                <span>Position X</span>
                <span className="font-mono text-purple-400">
                  {Number(activeVideoSeg?.transform?.x || 0).toFixed(1)}%
                </span>
              </label>
              <input 
                type="range" min="-100" max="100" step="0.1"
                value={activeVideoSeg?.transform?.x || 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVideoSegments?.((prev: any[]) => prev.map(s => 
                    selectedTargetIds.includes(s.id) 
                      ? { ...s, transform: { ...(s.transform || {y: 0, scale: 1}), x: val } } 
                      : s
                  ));
                }}
                className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          
            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium text-muted-foreground flex justify-between">
                <span>Position Y</span>
                <span className="font-mono text-purple-400">
                  {Number(activeVideoSeg?.transform?.y || 0).toFixed(1)}%
                </span>
              </label>
              <input 
                type="range" min="-100" max="100" step="0.1"
                value={activeVideoSeg?.transform?.y || 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVideoSegments?.((prev: any[]) => prev.map(s => 
                    selectedTargetIds.includes(s.id) 
                      ? { ...s, transform: { ...(s.transform || {x: 0, scale: 1}), y: val } } 
                      : s
                  ));
                }}
                className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          
            <div className="flex flex-col gap-3 col-span-2">
              <label className="text-xs font-medium text-muted-foreground flex justify-between">
                <span>Scale</span>
                <span className="font-mono text-purple-400">
                  {((activeVideoSeg?.transform?.scale || 1) * 100).toFixed(0)}%
                </span>
              </label>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" size="icon" className="h-7 w-7 shrink-0"
                  onClick={() => {
                    setVideoSegments?.((prev: any[]) => prev.map(s => 
                      selectedTargetIds.includes(s.id) 
                        ? { ...s, transform: { ...(s.transform || {x: 0, y: 0}), scale: Math.max(0.1, (s.transform?.scale || 1) - 0.05) } } 
                        : s
                    ));
                  }}
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <input 
                  type="range" min="0.1" max="3.0" step="0.005"
                  value={activeVideoSeg?.transform?.scale || 1}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVideoSegments?.((prev: any[]) => prev.map(s => 
                      selectedTargetIds.includes(s.id) 
                        ? { ...s, transform: { ...(s.transform || {x: 0, y: 0}), scale: val } } 
                        : s
                    ));
                  }}
                  className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                />
                <Button 
                  variant="outline" size="icon" className="h-7 w-7 shrink-0"
                  onClick={() => {
                    setVideoSegments?.((prev: any[]) => prev.map(s => 
                      selectedTargetIds.includes(s.id) 
                        ? { ...s, transform: { ...(s.transform || {x: 0, y: 0}), scale: Math.min(3, (s.transform?.scale || 1) + 0.05) } } 
                        : s
                    ));
                  }}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          
            <div className="col-span-2 flex justify-end">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-7 text-muted-foreground"
                onClick={() => {
                  setVideoSegments?.((prev: any[]) => prev.map(s => 
                    selectedTargetIds.includes(s.id) 
                      ? { ...s, transform: { x: 0, y: 0, scale: 1 } } 
                      : s
                  ));
                }}
              >
                Reset Transform
              </Button>
            </div>

            {/* Clip Crop Section */}
            <div className="col-span-2 border-t border-border pt-4 mt-2 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-purple-400" /> Crop Video Edges
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Crop Top */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground flex justify-between">
                    <span>Top Crop</span>
                    <span className="font-mono text-purple-400">
                      {Number(activeVideoSeg?.crop?.top || 0).toFixed(1)}%
                    </span>
                  </label>
                  <input 
                    type="range" min="0" max="50" step="0.5"
                    value={activeVideoSeg?.crop?.top || 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVideoSegments?.((prev: any[]) => prev.map(s => 
                        selectedTargetIds.includes(s.id) 
                          ? { ...s, crop: { ...(s.crop || { top: 0, bottom: 0, left: 0, right: 0 }), top: val } } 
                          : s
                      ));
                    }}
                    className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                  />
                </div>

                {/* Crop Bottom */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground flex justify-between">
                    <span>Bottom Crop</span>
                    <span className="font-mono text-purple-400">
                      {Number(activeVideoSeg?.crop?.bottom || 0).toFixed(1)}%
                    </span>
                  </label>
                  <input 
                    type="range" min="0" max="50" step="0.5"
                    value={activeVideoSeg?.crop?.bottom || 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVideoSegments?.((prev: any[]) => prev.map(s => 
                        selectedTargetIds.includes(s.id) 
                          ? { ...s, crop: { ...(s.crop || { top: 0, bottom: 0, left: 0, right: 0 }), bottom: val } } 
                          : s
                      ));
                    }}
                    className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                  />
                </div>

                {/* Crop Left */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground flex justify-between">
                    <span>Left Crop</span>
                    <span className="font-mono text-purple-400">
                      {Number(activeVideoSeg?.crop?.left || 0).toFixed(1)}%
                    </span>
                  </label>
                  <input 
                    type="range" min="0" max="50" step="0.5"
                    value={activeVideoSeg?.crop?.left || 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVideoSegments?.((prev: any[]) => prev.map(s => 
                        selectedTargetIds.includes(s.id) 
                          ? { ...s, crop: { ...(s.crop || { top: 0, bottom: 0, left: 0, right: 0 }), left: val } } 
                          : s
                      ));
                    }}
                    className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                  />
                </div>

                {/* Crop Right */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground flex justify-between">
                    <span>Right Crop</span>
                    <span className="font-mono text-purple-400">
                      {Number(activeVideoSeg?.crop?.right || 0).toFixed(1)}%
                    </span>
                  </label>
                  <input 
                    type="range" min="0" max="50" step="0.5"
                    value={activeVideoSeg?.crop?.right || 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVideoSegments?.((prev: any[]) => prev.map(s => 
                        selectedTargetIds.includes(s.id) 
                          ? { ...s, crop: { ...(s.crop || { top: 0, bottom: 0, left: 0, right: 0 }), right: val } } 
                          : s
                      ));
                    }}
                    className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                  />
                </div>
              </div>
            </div>

            {/* Gradient Masking / Edge Fade Out Section */}
            <div className="col-span-2 border-t border-border pt-4 mt-2 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Blend className="w-3.5 h-3.5 text-purple-400" /> Gradient Mask (Fade Out)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {activeVideoSeg?.gradientMask?.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <Switch 
                    checked={activeVideoSeg?.gradientMask?.enabled ?? false} 
                    onCheckedChange={(checked) => {
                      setVideoSegments?.((prev: any[]) => prev.map(s => 
                        selectedTargetIds.includes(s.id) 
                          ? { ...s, gradientMask: { ...(s.gradientMask || { direction: 'bottom', length: 30 }), enabled: checked } } 
                          : s
                      ));
                    }} 
                  />
                </div>
              </div>

              {activeVideoSeg?.gradientMask?.enabled && (
                <div className="flex flex-col gap-4 bg-muted/20 p-3 rounded-lg border border-border/50">
                  {/* Direction Selection */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-muted-foreground">Fade Out Direction</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['bottom', 'top', 'left', 'right'] as const).map((dir) => {
                        const currentDir = activeVideoSeg?.gradientMask?.direction || 'bottom';
                        const isSelected = currentDir === dir;
                        return (
                          <Button
                            key={dir}
                            type="button"
                            variant="outline"
                            size="sm"
                            className={`text-xs capitalize h-8 ${isSelected ? 'bg-purple-600/30 text-purple-300 border-purple-500/50 font-semibold' : 'text-muted-foreground'}`}
                            onClick={() => {
                              setVideoSegments?.((prev: any[]) => prev.map(s => 
                                selectedTargetIds.includes(s.id) 
                                  ? { ...s, gradientMask: { ...(s.gradientMask || { enabled: true, length: 30 }), direction: dir } } 
                                  : s
                              ));
                            }}
                          >
                            {dir === 'bottom' && <ArrowDown className="w-3 h-3 mr-1 inline" />}
                            {dir === 'top' && <ArrowUp className="w-3 h-3 mr-1 inline" />}
                            {dir === 'left' && <ArrowLeft className="w-3 h-3 mr-1 inline" />}
                            {dir === 'right' && <ArrowRight className="w-3 h-3 mr-1 inline" />}
                            {dir}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fade Length Slider */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-muted-foreground flex justify-between">
                      <span>Fade Out Length</span>
                      <span className="font-mono text-purple-400">
                        {activeVideoSeg?.gradientMask?.length ?? 30}%
                      </span>
                    </label>
                    <input 
                      type="range" min="5" max="100" step="1"
                      value={activeVideoSeg?.gradientMask?.length ?? 30}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setVideoSegments?.((prev: any[]) => prev.map(s => 
                          selectedTargetIds.includes(s.id) 
                            ? { ...s, gradientMask: { ...(s.gradientMask || { enabled: true, direction: 'bottom' }), length: val } } 
                            : s
                        ));
                      }}
                      className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-2 flex justify-end gap-2 border-t border-border/50 pt-3">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-7 text-muted-foreground"
                onClick={() => {
                  setVideoSegments?.((prev: any[]) => prev.map(s => 
                    selectedTargetIds.includes(s.id) 
                      ? { ...s, crop: { top: 0, bottom: 0, left: 0, right: 0 } } 
                      : s
                  ));
                }}
              >
                Reset Crop
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-7 text-muted-foreground"
                onClick={() => {
                  setVideoSegments?.((prev: any[]) => prev.map(s => 
                    selectedTargetIds.includes(s.id) 
                      ? { ...s, gradientMask: { enabled: false, direction: 'bottom', length: 30 } } 
                      : s
                  ));
                }}
              >
                Reset Mask
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-7 text-muted-foreground"
                onClick={() => {
                  setVideoSegments?.((prev: any[]) => prev.map(s => 
                    selectedTargetIds.includes(s.id) 
                      ? { ...s, transform: { x: 0, y: 0, scale: 1 }, crop: { top: 0, bottom: 0, left: 0, right: 0 }, gradientMask: { enabled: false, direction: 'bottom', length: 30 } } 
                      : s
                  ));
                }}
              >
                Reset All
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

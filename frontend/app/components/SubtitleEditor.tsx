import { Edit3, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatUiTime } from "@/lib/utils";

interface SubtitleEditorProps {
  editableSegments: any[];
  currentTime: number;
  handleSegmentChange: (index: number, newText: string) => void;
  clearProject: () => void;
  downloadSRT: () => void;
}

export function SubtitleEditor({
  editableSegments,
  currentTime,
  handleSegmentChange,
  clearProject,
  downloadSRT
}: SubtitleEditorProps) {
  return (
    <Card className="h-full flex flex-col bg-neutral-900 border-neutral-800 shadow-2xl overflow-hidden p-0 gap-0">
      <div className="p-4 border-b border-neutral-800 bg-neutral-900 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-300">
          <Edit3 className="w-4 h-4 text-blue-400" /> Subtitle Editor
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={clearProject} variant="destructive" size="sm" className="gap-2 h-8 text-xs px-3 shadow-lg">
            <Trash2 className="w-3 h-3" /> Clear
          </Button>
          <Button onClick={downloadSRT} size="sm" variant="secondary" className="gap-2 h-8 text-xs px-3 shadow-lg">
            <Download className="w-3 h-3" /> Download .SRT
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 h-0 bg-neutral-950/50">
        <div className="p-0">
          {editableSegments.map((segment, index) => {
            const isActive = currentTime >= segment.start && currentTime <= segment.end;
            return (
              <div 
                key={index} 
                id={`subtitle-segment-${index}`}
                className={`px-4 py-3 border-b transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-500/10 border-l-2 border-l-blue-500 border-b-blue-500/20' 
                    : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800/50 border-l-2 border-l-transparent'
                }`}
              >
                <div className="text-xs text-neutral-500 mb-2 flex justify-between font-mono tracking-wider">
                  <span>{formatUiTime(segment.start)}</span>
                  <span>{formatUiTime(segment.end)}</span>
                </div>
                <textarea
                  value={segment.text}
                  onChange={(e) => handleSegmentChange(index, e.target.value)}
                  className="w-full bg-transparent text-sm text-neutral-200 outline-none resize-none font-medium placeholder-neutral-700"
                  rows={1}
                  onInput={(e) => {
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                  }}
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}

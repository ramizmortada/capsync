import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper function for SRT time formatting
export const formatSrtTime = (seconds: number) => {
  const date = new Date(seconds * 1000);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
};

// Helper for UI time formatting (e.g., 00:12.3)
export const formatUiTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
};

export const injectPauseChips = (segs: any[]): any[] => {
  if (!segs || segs.length === 0) return segs;
  
  return segs.map((seg, idx) => {
    if (!seg.words || seg.words.length === 0) return seg;
    
    const cleanWords = seg.words.filter((w: any) => !w.isGap);
    const newWords: any[] = [];
    
    for (let i = 0; i < cleanWords.length; i++) {
      newWords.push(cleanWords[i]);
      
      if (i < cleanWords.length - 1) {
        const w1 = cleanWords[i];
        const w2 = cleanWords[i + 1];
        const gap = w2.start - w1.end;
        if (gap > 0.02) {
          newWords.push({
            word: `[Pause ${gap.toFixed(1)}s]`,
            start: w1.end,
            end: w2.start,
            isGap: true,
            deleted: false
          });
        }
      }
    }
    
    if (idx < segs.length - 1) {
      const nextSeg = segs[idx + 1];
      if (nextSeg.words && nextSeg.words.length > 0) {
        const wLast = cleanWords[cleanWords.length - 1];
        const nextCleanWords = nextSeg.words.filter((w: any) => !w.isGap);
        if (wLast && nextCleanWords.length > 0) {
          const wNextFirst = nextCleanWords[0];
          const gap = wNextFirst.start - wLast.end;
          if (gap > 0.02) {
            newWords.push({
              word: `[Pause ${gap.toFixed(1)}s]`,
              start: wLast.end,
              end: wNextFirst.start,
              isGap: true,
              deleted: false
            });
          }
        }
      }
    }
    
    return {
      ...seg,
      words: newWords
    };
  });
};


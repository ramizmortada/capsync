import { useEffect } from "react";
import { DragTarget } from "../app/types";

export function useTimelineDragging({
  draggingBoundary,
  setDraggingBoundary,
  trackRef,
  mediaDuration,
  rippleDeletes,
  editableSegments,
  setEditableSegments,
  setSegmentHistory,
}: {
  draggingBoundary: DragTarget | null;
  setDraggingBoundary: (t: DragTarget | null) => void;
  trackRef: React.RefObject<HTMLDivElement | null>;
  mediaDuration: number;
  rippleDeletes: { start: number; end: number }[];
  editableSegments: any[];
  setEditableSegments: React.Dispatch<React.SetStateAction<any[]>>;
  setSegmentHistory: React.Dispatch<React.SetStateAction<{ past: any[]; future: any[] }>>;
}) {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingBoundary === null || !trackRef.current || mediaDuration <= 0) return;
      
      const rect = trackRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      
      const sortedRippleDeletes = [...(rippleDeletes || [])].sort((a, b) => a.start - b.start);
      const toTimelineTime = (mediaTime: number) => {
        let timelineTime = mediaTime;
        for (const zone of sortedRippleDeletes) {
          if (mediaTime >= zone.end) {
            timelineTime -= (zone.end - zone.start);
          } else if (mediaTime > zone.start) {
            timelineTime -= (mediaTime - zone.start);
          }
        }
        return Math.max(0, timelineTime);
      };

      const toMediaTime = (timelineTime: number) => {
        let mediaTime = timelineTime;
        for (const zone of sortedRippleDeletes) {
          if (mediaTime >= zone.start) {
            mediaTime += (zone.end - zone.start);
          }
        }
        return Math.min(mediaTime, mediaDuration);
      };

      const timelineDuration = Math.max(toTimelineTime(mediaDuration), 0.1);
      const percentage = clickX / rect.width;
      const targetTimelineTime = percentage * timelineDuration;
      let newTime = toMediaTime(targetTimelineTime);
      
      let newSegments = [...editableSegments];
      
      if (draggingBoundary === 'start') {
        const nextEnd = newSegments[0].end;
        newTime = Math.max(0, Math.min(newTime, nextEnd - 0.1));
        const seg = { ...newSegments[0], start: newTime };
        if (seg.words && seg.words.length > 0) {
          const words = [...seg.words];
          words[0] = { ...words[0], start: newTime };
          seg.words = words;
        }
        newSegments[0] = seg;
      } else if (draggingBoundary === 'end') {
        const prevStart = newSegments[newSegments.length - 1].start;
        newTime = Math.max(prevStart + 0.1, Math.min(newTime, mediaDuration));
        const seg = { ...newSegments[newSegments.length - 1], end: newTime };
        if (seg.words && seg.words.length > 0) {
          const words = [...seg.words];
          const lastIdx = words.length - 1;
          words[lastIdx] = { ...words[lastIdx], end: newTime };
          seg.words = words;
        }
        newSegments[newSegments.length - 1] = seg;
      } else {
        const boundary = draggingBoundary as any;
        if ('wordIdx' in boundary) {
          const { type, segmentIdx, wordIdx } = boundary;
          const currSegment = newSegments[segmentIdx];
          const currWords = [...(currSegment.words || [])];
          const currWord = currWords[wordIdx];
          const nextWord = currWords[wordIdx + 1];

          if (type === 'start') {
            const prevWord = wordIdx > 0 ? currWords[wordIdx - 1] : null;
            const prevEnd = prevWord ? prevWord.end : currSegment.start;
            
            if (prevWord && prevWord.isGap) {
              const minStart = prevWord.start + 0.02; 
              newTime = Math.max(minStart, Math.min(newTime, currWord.end - 0.05));
              currWords[wordIdx - 1] = { ...prevWord, end: newTime };
            } else {
              newTime = Math.max(prevEnd, Math.min(newTime, currWord.end - 0.05));
            }
            currWords[wordIdx] = { ...currWord, start: newTime };
          } else if (type === 'end') {
            const nextWord = wordIdx < currWords.length - 1 ? currWords[wordIdx + 1] : null;
            const nextStart = nextWord ? nextWord.start : currSegment.end;
            
            if (nextWord && nextWord.isGap) {
              const maxEnd = nextWord.end - 0.02;
              newTime = Math.max(currWord.start + 0.05, Math.min(newTime, maxEnd));
              currWords[wordIdx + 1] = { ...nextWord, start: newTime };
            } else {
              newTime = Math.max(currWord.start + 0.05, Math.min(newTime, nextStart));
            }
            currWords[wordIdx] = { ...currWord, end: newTime };
          } else if (type === 'gap-ripple') {
            const gapWord = currWords[wordIdx];
            const oldEnd = gapWord.end;
            newTime = Math.max(gapWord.start + 0.02, Math.min(newTime, mediaDuration));
            const delta = newTime - oldEnd;

            if (Math.abs(delta) > 0.001) {
              currWords[wordIdx] = { ...gapWord, end: newTime };

              for (let i = wordIdx + 1; i < currWords.length; i++) {
                currWords[i] = {
                  ...currWords[i],
                  start: currWords[i].start + delta,
                  end: currWords[i].end + delta
                };
              }
              currSegment.words = currWords;
              currSegment.end += delta;
              newSegments[segmentIdx] = currSegment;

              for (let s = segmentIdx + 1; s < newSegments.length; s++) {
                const nextSeg = { ...newSegments[s] };
                nextSeg.start += delta;
                nextSeg.end += delta;
                if (nextSeg.words) {
                  nextSeg.words = nextSeg.words.map((w: any) => ({
                    ...w,
                    start: w.start + delta,
                    end: w.end + delta
                  }));
                }
                newSegments[s] = nextSeg;
              }
            }
          } else if (type === 'both' && nextWord) {
            const minBound = currWord.start + 0.02;
            const maxBound = nextWord.end - 0.02;
            newTime = Math.max(minBound, Math.min(newTime, maxBound));
            currWords[wordIdx] = { ...currWord, end: newTime };
            currWords[wordIdx + 1] = { ...nextWord, start: newTime };
            newSegments[segmentIdx] = { ...currSegment, words: currWords };
          }
        } else {
          const { type, index } = boundary;
          const currSegment = newSegments[index];
          const nextSegment = newSegments[index + 1];

          if (type === 'start') {
            const prevEnd = index > 0 ? newSegments[index - 1].end : 0;
            newTime = Math.max(prevEnd, Math.min(newTime, currSegment.end - 0.1));
            newSegments[index] = { ...currSegment, start: newTime };
          } else if (type === 'end') {
            const nextStart = index < newSegments.length - 1 ? newSegments[index + 1].start : mediaDuration;
            newTime = Math.max(currSegment.start + 0.1, Math.min(newTime, nextStart));
            newSegments[index] = { ...currSegment, end: newTime };
          } else if (type === 'both') {
            const prevStart = currSegment.start;
            const nextEnd = nextSegment.end;
            newTime = Math.max(prevStart + 0.1, Math.min(newTime, nextEnd - 0.1));
            
            currSegment.end = newTime;
            nextSegment.start = newTime;

            if (currSegment.words && currSegment.words.length > 0) {
              const words = [...currSegment.words];
              const lastWordIdx = words.length - 1;
              words[lastWordIdx] = { ...words[lastWordIdx], end: newTime };
              currSegment.words = words;
            }

            if (nextSegment.words && nextSegment.words.length > 0) {
              const words = [...nextSegment.words];
              words[0] = { ...words[0], start: newTime };
              nextSegment.words = words;
            }

            newSegments[index] = currSegment;
            newSegments[index + 1] = nextSegment;
          }
        }
      }
      
      setEditableSegments(newSegments);
    };

    const handleMouseUp = () => {
      if (draggingBoundary !== null) {
        setSegmentHistory((prev: any) => ({
          past: [...prev.past, { segments: editableSegments, rippleDeletes: [...rippleDeletes] }].slice(-50),
          future: []
        }));
        setDraggingBoundary(null);
      }
    };

    if (draggingBoundary !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingBoundary, editableSegments, mediaDuration, rippleDeletes, trackRef]);
}

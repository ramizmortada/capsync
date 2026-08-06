import { useEffect } from "react";
import { DragTarget } from "../app/types";

export function useTimelineDragging({
  draggingBoundary,
  setDraggingBoundary,
  trackRef,
  mediaDuration,
  videoSegments,
  editableSegments,
  setEditableSegments,
  setSegmentHistory,
}: {
  draggingBoundary: DragTarget | null;
  setDraggingBoundary: (t: DragTarget | null) => void;
  trackRef: React.RefObject<HTMLDivElement | null>;
  mediaDuration: number;
  videoSegments: any[];
  editableSegments: any[];
  setEditableSegments: React.Dispatch<React.SetStateAction<any[]>>;
  setSegmentHistory: React.Dispatch<React.SetStateAction<{ past: any[]; future: any[] }>>;
}) {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingBoundary === null || !trackRef.current || mediaDuration <= 0) return;
      
      const rect = trackRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;

      const activeSegs = (videoSegments || []).filter((s: any) => !s.deleted).sort((a: any, b: any) => a.timelineStart - b.timelineStart);

      const timelineDuration = activeSegs.length > 0
        ? Math.max(activeSegs[activeSegs.length - 1].timelineEnd, 0.1)
        : Math.max(mediaDuration, 0.1);

      const percentage = clickX / rect.width;
      const targetTimelineTime = percentage * timelineDuration;

      const toMediaTime = (tlTime: number) => {
        const seg = activeSegs.find((s: any) => tlTime >= s.timelineStart && tlTime <= s.timelineEnd);
        if (seg) return seg.sourceStart + (tlTime - seg.timelineStart);
        const closest = [...activeSegs].sort((a: any, b: any) => Math.abs(a.timelineStart - tlTime) - Math.abs(b.timelineStart - tlTime))[0];
        if (closest) {
          return closest.sourceStart + (tlTime - closest.timelineStart);
        }
        return tlTime;
      };

      let newTime = targetTimelineTime;
      
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
        newTime = Math.max(prevStart + 0.1, Math.min(newTime, timelineDuration));
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
            newTime = Math.max(gapWord.start + 0.02, Math.min(newTime, timelineDuration));
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
            const seg = { ...currSegment, start: newTime };
            if (seg.words && seg.words.length > 0) {
              const words = [...seg.words];
              words[0] = { ...words[0], start: newTime };
              seg.words = words;
            }
            newSegments[index] = seg;
          } else if (type === 'end') {
            const nextStart = index < newSegments.length - 1 ? newSegments[index + 1].start : timelineDuration;
            newTime = Math.max(currSegment.start + 0.1, Math.min(newTime, nextStart));
            const seg = { ...currSegment, end: newTime };
            if (seg.words && seg.words.length > 0) {
              const words = [...seg.words];
              const lastIdx = words.length - 1;
              words[lastIdx] = { ...words[lastIdx], end: newTime };
              seg.words = words;
            }
            newSegments[index] = seg;
          } else if (type === 'body') {
            const currSegment = { ...newSegments[index] };
            const duration = currSegment.end - currSegment.start;
            const dragOffset = boundary.dragOffset || 0;
            const prevEnd = index > 0 ? newSegments[index - 1].end : 0;
            const nextStart = index < newSegments.length - 1 ? newSegments[index + 1].start : timelineDuration;

            let targetStart = targetTimelineTime - dragOffset;
            targetStart = Math.max(prevEnd, Math.min(targetStart, nextStart - duration));
            const targetEnd = targetStart + duration;
            const delta = targetStart - currSegment.start;

            if (Math.abs(delta) > 0.001) {
              currSegment.start = targetStart;
              currSegment.end = targetEnd;
              if (currSegment.words && currSegment.words.length > 0) {
                currSegment.words = currSegment.words.map((w: any) => ({
                  ...w,
                  start: w.start + delta,
                  end: w.end + delta,
                }));
              }
              newSegments[index] = currSegment;
            }
          } else if (type === 'both' && nextSegment) {
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
          past: [...prev.past, {
            segments: JSON.parse(JSON.stringify(editableSegments || [])),
            rippleDeletes: JSON.parse(JSON.stringify((prev.past[prev.past.length - 1]?.rippleDeletes) || [])),
            videoSegments: JSON.parse(JSON.stringify(videoSegments || []))
          }].slice(-50),
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
  }, [draggingBoundary, editableSegments, mediaDuration, videoSegments, trackRef]);
}

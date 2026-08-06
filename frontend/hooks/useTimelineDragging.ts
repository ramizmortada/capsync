import { useEffect } from "react";
import { DragTarget } from "../app/types";

function adjustWordsOnStartChange(words: any[], newStart: number) {
  if (!words || words.length === 0) return words;
  const updatedWords = words.map((w: any) => ({ ...w }));
  updatedWords[0] = { ...updatedWords[0], start: newStart };
  if (updatedWords[0].end < newStart) {
    updatedWords[0].end = newStart + 0.05;
  }
  for (let i = 0; i < updatedWords.length; i++) {
    if (i > 0) {
      if (updatedWords[i].start < updatedWords[i - 1].end) {
        updatedWords[i].start = updatedWords[i - 1].end;
      }
    }
    if (updatedWords[i].end < updatedWords[i].start) {
      updatedWords[i].end = updatedWords[i].start + 0.05;
    }
  }
  return updatedWords;
}

function adjustWordsOnEndChange(words: any[], newEnd: number) {
  if (!words || words.length === 0) return words;
  const updatedWords = words.map((w: any) => ({ ...w }));
  const lastIdx = updatedWords.length - 1;
  updatedWords[lastIdx] = { ...updatedWords[lastIdx], end: newEnd };
  if (updatedWords[lastIdx].start > newEnd) {
    updatedWords[lastIdx].start = Math.max(0, newEnd - 0.05);
  }
  for (let i = lastIdx; i >= 0; i--) {
    if (i < lastIdx) {
      if (updatedWords[i].end > updatedWords[i + 1].start) {
        updatedWords[i].end = updatedWords[i + 1].start;
      }
    }
    if (updatedWords[i].start > updatedWords[i].end) {
      updatedWords[i].start = Math.max(0, updatedWords[i].end - 0.05);
    }
  }
  return updatedWords;
}

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
        if (!activeSegs || activeSegs.length === 0) return tlTime;

        if (tlTime <= activeSegs[0].timelineStart) {
          return Math.max(0, activeSegs[0].sourceStart + (tlTime - activeSegs[0].timelineStart));
        }

        for (let i = 0; i < activeSegs.length; i++) {
          const seg = activeSegs[i];
          if (tlTime >= seg.timelineStart && tlTime <= seg.timelineEnd) {
            return seg.sourceStart + (tlTime - seg.timelineStart);
          }
          if (i < activeSegs.length - 1) {
            const nextSeg = activeSegs[i + 1];
            if (tlTime > seg.timelineEnd && tlTime < nextSeg.timelineStart) {
              const gapDuration = nextSeg.timelineStart - seg.timelineEnd;
              if (gapDuration <= 0.001) return seg.sourceEnd;
              const ratio = (tlTime - seg.timelineEnd) / gapDuration;
              return seg.sourceEnd + ratio * (nextSeg.sourceStart - seg.sourceEnd);
            }
          }
        }

        const last = activeSegs[activeSegs.length - 1];
        return last.sourceEnd + (tlTime - last.timelineEnd);
      };

      let newTime = toMediaTime(targetTimelineTime);
      
      let newSegments = [...editableSegments];
      
      if (draggingBoundary === 'start') {
        const nextEnd = newSegments[0].end;
        newTime = Math.max(0, Math.min(newTime, nextEnd - 0.1));
        const seg = { ...newSegments[0], start: newTime };
        if (seg.words && seg.words.length > 0) {
          seg.words = adjustWordsOnStartChange(seg.words, newTime);
        }
        newSegments[0] = seg;
      } else if (draggingBoundary === 'end') {
        const prevStart = newSegments[newSegments.length - 1].start;
        const maxMediaTime = toMediaTime(timelineDuration);
        newTime = Math.max(prevStart + 0.1, Math.min(newTime, maxMediaTime));
        const seg = { ...newSegments[newSegments.length - 1], end: newTime };
        if (seg.words && seg.words.length > 0) {
          seg.words = adjustWordsOnEndChange(seg.words, newTime);
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
            const maxMediaTime = toMediaTime(timelineDuration);
            newTime = Math.max(gapWord.start + 0.02, Math.min(newTime, maxMediaTime));
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
            const maxTime = currSegment.end - 0.1;
            newTime = Math.max(0, Math.min(newTime, maxTime));
            const seg = { ...currSegment, start: newTime };
            if (seg.words && seg.words.length > 0) {
              seg.words = adjustWordsOnStartChange(seg.words, newTime);
            }
            newSegments[index] = seg;
          } else if (type === 'end') {
            const maxMediaTime = toMediaTime(timelineDuration);
            const minTime = currSegment.start + 0.1;
            newTime = Math.max(minTime, Math.min(newTime, maxMediaTime));
            const seg = { ...currSegment, end: newTime };
            if (seg.words && seg.words.length > 0) {
              seg.words = adjustWordsOnEndChange(seg.words, newTime);
            }
            newSegments[index] = seg;
          } else if (type === 'body') {
            const currSegment = { ...newSegments[index] };
            const duration = currSegment.end - currSegment.start;
            const dragOffset = boundary.dragOffset || 0;
            const maxMediaTime = toMediaTime(timelineDuration);

            let targetStart = toMediaTime(targetTimelineTime) - dragOffset;
            targetStart = Math.max(0, Math.min(targetStart, maxMediaTime - duration));
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
              currSegment.words = adjustWordsOnEndChange(currSegment.words, newTime);
            }

            if (nextSegment.words && nextSegment.words.length > 0) {
              nextSegment.words = adjustWordsOnStartChange(nextSegment.words, newTime);
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

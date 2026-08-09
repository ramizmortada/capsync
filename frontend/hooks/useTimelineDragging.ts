import { useEffect } from "react";
import { DragTarget } from "../app/types";

function adjustWordsOnStartChange(words: any[], newStart: number) {
  if (!words || words.length === 0) return words;
  const EPSILON = 0.01;
  const result: any[] = [];
  
  for (const w of words) {
    if (w.end <= newStart + EPSILON) continue; // Drop word entirely outside
    
    if (w.start >= newStart - EPSILON) {
      result.push({ ...w });
    } else {
      const clamped = { ...w, start: newStart };
      if (clamped.end - clamped.start > EPSILON) {
        result.push(clamped);
      }
    }
  }

  if (result.length > 0) {
    result[0] = { ...result[0], start: newStart };
  }

  return result;
}

function adjustWordsOnEndChange(words: any[], newEnd: number) {
  if (!words || words.length === 0) return words;
  const EPSILON = 0.01;
  const result: any[] = [];
  
  for (const w of words) {
    if (w.start >= newEnd - EPSILON) continue; // Drop word entirely outside
    
    if (w.end <= newEnd + EPSILON) {
      result.push({ ...w });
    } else {
      const clamped = { ...w, end: newEnd };
      if (clamped.end - clamped.start > EPSILON) {
        result.push(clamped);
      }
    }
  }

  if (result.length > 0) {
    result[result.length - 1] = { ...result[result.length - 1], end: newEnd };
  }

  return result;
}

function rebuildText(words: any[] | undefined, fallbackText: string): string {
  if (!words || words.length === 0) return fallbackText;
  const spoken = words.filter((w: any) => !w.isGap && !w.deleted);
  if (spoken.length === 0) return fallbackText;
  return spoken.map((w: any) => w.word || w.text || '').join(' ');
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
  selectedIndexes = [],
}: {
  draggingBoundary: DragTarget | null;
  setDraggingBoundary: (t: DragTarget | null) => void;
  trackRef: React.RefObject<HTMLDivElement | null>;
  mediaDuration: number;
  videoSegments: any[];
  editableSegments: any[];
  setEditableSegments: React.Dispatch<React.SetStateAction<any[]>>;
  setSegmentHistory: React.Dispatch<React.SetStateAction<{ past: any[]; future: any[] }>>;
  selectedIndexes?: (number | string)[];
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
            if (wordIdx === 0) {
              const prevSegment = segmentIdx > 0 ? newSegments[segmentIdx - 1] : null;
              const maxTime = currWord.end - 0.05;
              const minTime = prevSegment ? prevSegment.start + 0.1 : 0;
              newTime = Math.max(minTime, Math.min(newTime, maxTime));

              currWords[0] = { ...currWord, start: newTime };
              const seg = { ...currSegment, start: newTime, words: currWords };
              seg.text = rebuildText(seg.words, seg.text);
              newSegments[segmentIdx] = seg;

              if (prevSegment && newTime <= prevSegment.end) {
                const prevSeg = { ...prevSegment, end: newTime };
                if (prevSeg.words && prevSeg.words.length > 0) {
                  prevSeg.words = adjustWordsOnEndChange(prevSeg.words, newTime);
                  prevSeg.text = rebuildText(prevSeg.words, prevSeg.text);
                }
                newSegments[segmentIdx - 1] = prevSeg;
              }
            } else {
              const prevWord = currWords[wordIdx - 1];
              const prevEnd = prevWord ? prevWord.end : currSegment.start;
              
              if (prevWord && prevWord.isGap) {
                const minStart = prevWord.start + 0.02; 
                newTime = Math.max(minStart, Math.min(newTime, currWord.end - 0.05));
                currWords[wordIdx - 1] = { ...prevWord, end: newTime };
              } else {
                newTime = Math.max(prevEnd, Math.min(newTime, currWord.end - 0.05));
              }
              currWords[wordIdx] = { ...currWord, start: newTime };
              newSegments[segmentIdx] = { ...currSegment, words: currWords };
            }
          } else if (type === 'end') {
            if (wordIdx === currWords.length - 1) {
              const nextSeg = segmentIdx < newSegments.length - 1 ? newSegments[segmentIdx + 1] : null;
              const maxMediaTime = toMediaTime(timelineDuration);
              const minTime = currWord.start + 0.05;
              const maxTime = nextSeg ? nextSeg.end - 0.1 : maxMediaTime;
              newTime = Math.max(minTime, Math.min(newTime, maxTime));

              currWords[wordIdx] = { ...currWord, end: newTime };
              const seg = { ...currSegment, end: newTime, words: currWords };
              seg.text = rebuildText(seg.words, seg.text);
              newSegments[segmentIdx] = seg;

              if (nextSeg && newTime >= nextSeg.start) {
                const pushed = { ...nextSeg, start: newTime };
                if (pushed.words && pushed.words.length > 0) {
                  pushed.words = adjustWordsOnStartChange(pushed.words, newTime);
                  pushed.text = rebuildText(pushed.words, pushed.text);
                }
                newSegments[segmentIdx + 1] = pushed;
              }
            } else {
              const nextWord = currWords[wordIdx + 1];
              const nextStart = nextWord ? nextWord.start : currSegment.end;
              
              if (nextWord && nextWord.isGap) {
                const maxEnd = nextWord.end - 0.02;
                newTime = Math.max(currWord.start + 0.05, Math.min(newTime, maxEnd));
                currWords[wordIdx + 1] = { ...nextWord, start: newTime };
              } else {
                newTime = Math.max(currWord.start + 0.05, Math.min(newTime, nextStart));
              }
              currWords[wordIdx] = { ...currWord, end: newTime };
              newSegments[segmentIdx] = { ...currSegment, words: currWords };
            }
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
            const prevSegment = index > 0 ? newSegments[index - 1] : null;
            const maxTime = currSegment.end - 0.1;
            const minTime = prevSegment ? prevSegment.start + 0.1 : 0;
            newTime = Math.max(minTime, Math.min(newTime, maxTime));

            const seg = { ...currSegment, start: newTime };
            if (seg.words && seg.words.length > 0) {
              seg.words = adjustWordsOnStartChange(seg.words, newTime);
              seg.text = rebuildText(seg.words, seg.text);
            }
            newSegments[index] = seg;

            // Push the previous segment's end if we reached it
            if (prevSegment && newTime <= prevSegment.end) {
              const prevSeg = { ...prevSegment, end: newTime };
              if (prevSeg.words && prevSeg.words.length > 0) {
                prevSeg.words = adjustWordsOnEndChange(prevSeg.words, newTime);
                prevSeg.text = rebuildText(prevSeg.words, prevSeg.text);
              }
              newSegments[index - 1] = prevSeg;
            }
          } else if (type === 'end') {
            const nextSeg = index < newSegments.length - 1 ? newSegments[index + 1] : null;
            const maxMediaTime = toMediaTime(timelineDuration);
            const minTime = currSegment.start + 0.1;
            const maxTime = nextSeg ? nextSeg.end - 0.1 : maxMediaTime;
            newTime = Math.max(minTime, Math.min(newTime, maxTime));

            const seg = { ...currSegment, end: newTime };
            if (seg.words && seg.words.length > 0) {
              seg.words = adjustWordsOnEndChange(seg.words, newTime);
              seg.text = rebuildText(seg.words, seg.text);
            }
            newSegments[index] = seg;

            // Push the next segment's start if we reached it
            if (nextSeg && newTime >= nextSeg.start) {
              const pushed = { ...nextSeg, start: newTime };
              if (pushed.words && pushed.words.length > 0) {
                pushed.words = adjustWordsOnStartChange(pushed.words, newTime);
                pushed.text = rebuildText(pushed.words, pushed.text);
              }
              newSegments[index + 1] = pushed;
            }
          } else if (type === 'body') {
            const currSegment = { ...newSegments[index] };
            const duration = currSegment.end - currSegment.start;
            const dragOffset = boundary.dragOffset || 0;
            const maxMediaTime = toMediaTime(timelineDuration);

            let targetStart = toMediaTime(targetTimelineTime) - dragOffset;
            targetStart = Math.max(0, Math.min(targetStart, maxMediaTime - duration));
            const delta = targetStart - currSegment.start;

            if (Math.abs(delta) > 0.001) {
              const numSelectedIndexes = selectedIndexes
                .filter((i) => typeof i === 'number' && i >= 0 && i < newSegments.length) as number[];
              const isMultiSelect = numSelectedIndexes.includes(index) && numSelectedIndexes.length > 1;

              if (isMultiSelect) {
                // Ensure no selected segment moves before start time 0
                let validDelta = delta;
                for (const idx of numSelectedIndexes) {
                  if (newSegments[idx] && newSegments[idx].start + validDelta < 0) {
                    validDelta = -newSegments[idx].start;
                  }
                }

                if (Math.abs(validDelta) > 0.0001) {
                  for (const idx of numSelectedIndexes) {
                    if (newSegments[idx]) {
                      const seg = { ...newSegments[idx] };
                      seg.start += validDelta;
                      seg.end += validDelta;
                      if (seg.words && seg.words.length > 0) {
                        seg.words = seg.words.map((w: any) => ({
                          ...w,
                          start: w.start + validDelta,
                          end: w.end + validDelta,
                        }));
                      }
                      newSegments[idx] = seg;
                    }
                  }
                }
              } else {
                currSegment.start = targetStart;
                currSegment.end = targetStart + duration;
                if (currSegment.words && currSegment.words.length > 0) {
                  currSegment.words = currSegment.words.map((w: any) => ({
                    ...w,
                    start: w.start + delta,
                    end: w.end + delta,
                  }));
                }
                newSegments[index] = currSegment;
              }
            }
          } else if (type === 'both' && nextSegment) {
            const prevStart = currSegment.start;
            const nextEnd = nextSegment.end;
            newTime = Math.max(prevStart + 0.1, Math.min(newTime, nextEnd - 0.1));
            
            currSegment.end = newTime;
            nextSegment.start = newTime;

            if (currSegment.words && currSegment.words.length > 0) {
              currSegment.words = adjustWordsOnEndChange(currSegment.words, newTime);
              currSegment.text = rebuildText(currSegment.words, currSegment.text);
            }

            if (nextSegment.words && nextSegment.words.length > 0) {
              nextSegment.words = adjustWordsOnStartChange(nextSegment.words, newTime);
              nextSegment.text = rebuildText(nextSegment.words, nextSegment.text);
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

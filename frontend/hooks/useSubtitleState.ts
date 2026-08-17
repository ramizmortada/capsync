import { useState } from "react";
import { resegmentTranscripts } from "@/lib/chunking";
import { set as idbSet } from "idb-keyval";
import { mapTranscriptionToTimeline } from "./useTranscription";

export interface VideoSegment {
  id: string;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  timelineEnd: number;
  deleted: boolean;
  transform?: {
    x: number;
    y: number;
    scale: number;
  };
  crop?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  gradientMask?: {
    enabled: boolean;
    direction: 'top' | 'bottom' | 'left' | 'right';
    length: number;
  };
}

export interface AudioSegment {
  id: string;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  timelineEnd: number;
  deleted: boolean;
  muted?: boolean;
  linkedVideoId?: string;
}

type HistoryState = { 
  segments: any[]; 
  rippleDeletes: { start: number; end: number }[];
  videoSegments: VideoSegment[];
  audioSegments: AudioSegment[];
};

export function useSubtitleState({
  file,
  status,
  result,
  setResult,
  silenceThreshold,
}: {
  file: File | null;
  status: string;
  result: any;
  setResult: (r: any) => void;
  silenceThreshold: number;
}) {
  const [editableSegments, setEditableSegments] = useState<any[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<(number | string)[]>([]);
  
  const [videoSegments, setVideoSegments] = useState<VideoSegment[]>([]);
  const [selectedVideoIndexes, setSelectedVideoIndexes] = useState<string[]>([]);
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
  const [selectedAudioIndexes, setSelectedAudioIndexes] = useState<string[]>([]);
  const [isAudioLinked, setIsAudioLinked] = useState<boolean>(true);
  const [cursorMode, setCursorMode] = useState<'select' | 'cut' | 'resize'>('select');

  const [rippleDeletes, setRippleDeletes] = useState<{ start: number; end: number }[]>([]);
  const [segmentHistory, setSegmentHistory] = useState<{ past: HistoryState[]; future: HistoryState[] }>({
    past: [],
    future: [],
  });

  const cloneState = (
    segments: any[], 
    rippleDeletesList: any[], 
    videoSegs: VideoSegment[], 
    audioSegs: AudioSegment[] = []
  ): HistoryState => ({
    segments: JSON.parse(JSON.stringify(segments || [])),
    rippleDeletes: JSON.parse(JSON.stringify(rippleDeletesList || [])),
    videoSegments: JSON.parse(JSON.stringify(videoSegs || [])),
    audioSegments: JSON.parse(JSON.stringify(audioSegs || [])),
  });

  /**
   * Trims, splits, or removes subtitle segments that overlap with deleted regions.
   * - Full overlap: segment is removed entirely.
   * - Partial overlap (tail): segment.end is trimmed to region.start.
   * - Partial overlap (head): segment.start is trimmed to region.end.
   * - Bridge (segment spans across the region): segment is split into two pieces.
   * Word-level timestamps are also trimmed/filtered accordingly.
   */
  const trimSubtitlesByRegions = (segments: any[], regions: { start: number; end: number }[]): any[] => {
    if (!regions || regions.length === 0) return segments;

    let result = [...segments];

    for (const region of regions) {
      const trimmed: any[] = [];

      for (const seg of result) {
        const EPSILON = 0.01;

        // No overlap at all — keep as-is
        if (seg.end <= region.start + EPSILON || seg.start >= region.end - EPSILON) {
          trimmed.push(seg);
          continue;
        }

        // Full overlap — segment is entirely inside the deleted region
        if (seg.start >= region.start - EPSILON && seg.end <= region.end + EPSILON) {
          // Remove it entirely (don't push)
          continue;
        }

        // Bridge — segment spans across the entire deleted region
        // Split into two: [seg.start..region.start] and [region.end..seg.end]
        if (seg.start < region.start - EPSILON && seg.end > region.end + EPSILON) {
          const leftPart = { ...seg };
          leftPart.end = region.start;
          if (leftPart.words) {
            leftPart.words = trimWordsToRange(leftPart.words, leftPart.start, region.start);
          }
          leftPart.text = rebuildText(leftPart.words, leftPart.text);
          if (leftPart.end - leftPart.start > EPSILON) {
            trimmed.push(leftPart);
          }

          const rightPart = { ...seg };
          rightPart.start = region.end;
          if (rightPart.words) {
            rightPart.words = trimWordsToRange(rightPart.words, region.end, rightPart.end);
          }
          rightPart.text = rebuildText(rightPart.words, rightPart.text);
          if (rightPart.end - rightPart.start > EPSILON) {
            trimmed.push(rightPart);
          }
          continue;
        }

        // Partial overlap — tail extends into region (seg.start < region.start, seg.end inside region)
        if (seg.start < region.start - EPSILON) {
          const trimmedSeg = { ...seg, end: region.start };
          if (trimmedSeg.words) {
            trimmedSeg.words = trimWordsToRange(trimmedSeg.words, trimmedSeg.start, region.start);
          }
          trimmedSeg.text = rebuildText(trimmedSeg.words, trimmedSeg.text);
          if (trimmedSeg.end - trimmedSeg.start > EPSILON) {
            trimmed.push(trimmedSeg);
          }
          continue;
        }

        // Partial overlap — head starts inside region (seg.start inside region, seg.end > region.end)
        if (seg.end > region.end + EPSILON) {
          const trimmedSeg = { ...seg, start: region.end };
          if (trimmedSeg.words) {
            trimmedSeg.words = trimWordsToRange(trimmedSeg.words, region.end, trimmedSeg.end);
          }
          trimmedSeg.text = rebuildText(trimmedSeg.words, trimmedSeg.text);
          if (trimmedSeg.end - trimmedSeg.start > EPSILON) {
            trimmed.push(trimmedSeg);
          }
          continue;
        }

        // Fallback — shouldn't reach here, but keep it
        trimmed.push(seg);
      }

      result = trimmed;
    }

    return result;
  };

  /** Filter and clamp words to only those within [rangeStart, rangeEnd] */
  const trimWordsToRange = (words: any[], rangeStart: number, rangeEnd: number): any[] => {
    const EPSILON = 0.01;
    const result: any[] = [];

    for (const w of words) {
      // Word is entirely outside the range — drop it
      if (w.end <= rangeStart + EPSILON || w.start >= rangeEnd - EPSILON) {
        continue;
      }

      // Word is entirely inside the range — keep as-is
      if (w.start >= rangeStart - EPSILON && w.end <= rangeEnd + EPSILON) {
        result.push({ ...w });
        continue;
      }

      // Word partially overlaps — clamp its boundaries
      const clampedWord = { ...w };
      clampedWord.start = Math.max(w.start, rangeStart);
      clampedWord.end = Math.min(w.end, rangeEnd);
      if (clampedWord.end - clampedWord.start > EPSILON) {
        result.push(clampedWord);
      }
    }

    if (result.length > 0) {
      result[0] = { ...result[0], start: rangeStart };
      result[result.length - 1] = { ...result[result.length - 1], end: rangeEnd };
    }

    return result;
  };

  /** Rebuild the text property from surviving non-deleted, non-gap words */
  const rebuildText = (words: any[] | undefined, fallbackText: string): string => {
    if (!words || words.length === 0) return fallbackText;
    const spoken = words.filter((w: any) => !w.isGap && !w.deleted);
    if (spoken.length === 0) return fallbackText;
    return spoken.map((w: any) => w.word || w.text || '').join(' ');
  };

  const updateSegments = (newSegments: any[] | ((prev: any[]) => any[])) => {
    setEditableSegments((prevSegments) => {
      const updated = typeof newSegments === "function" ? newSegments(prevSegments) : newSegments;
      setSegmentHistory((prevHistory) => ({
        past: [...prevHistory.past, cloneState(prevSegments, rippleDeletes, videoSegments, audioSegments)].slice(-50),
        future: [],
      }));
      return updated;
    });
  };

  const updateVideoSegments = (newVideoSegments: VideoSegment[] | ((prev: VideoSegment[]) => VideoSegment[])) => {
    setVideoSegments((prevSegments) => {
      const updated = typeof newVideoSegments === "function" ? newVideoSegments(prevSegments) : newVideoSegments;
      setSegmentHistory((prevHistory) => ({
        past: [...prevHistory.past, cloneState(editableSegments, rippleDeletes, prevSegments, audioSegments)].slice(-50),
        future: [],
      }));
      return updated;
    });
  };

  const updateAudioSegments = (newAudioSegments: AudioSegment[] | ((prev: AudioSegment[]) => AudioSegment[])) => {
    setAudioSegments((prevSegments) => {
      const updated = typeof newAudioSegments === "function" ? newAudioSegments(prevSegments) : newAudioSegments;
      setSegmentHistory((prevHistory) => ({
        past: [...prevHistory.past, cloneState(editableSegments, rippleDeletes, videoSegments, prevSegments)].slice(-50),
        future: [],
      }));
      return updated;
    });
  };

  const handleResegment = (maxWords: string) => {
    if (!result || !result.raw_segments) return;
    const rechunkedSegments = resegmentTranscripts(result.raw_segments, maxWords);
    const newSegments = mapTranscriptionToTimeline(rechunkedSegments, videoSegments);
    updateSegments(newSegments);
    const newResult = { ...result, segments: newSegments };
    setResult(newResult);
    idbSet("capsync_project", {
      file: file,
      status: status,
      result: newResult,
      editableSegments: newSegments,
    }).catch(console.error);
  };

  /** Align edited text with existing segment words and calculate non-overlapping, adjacent word timings */
  const alignAndRetimeWords = (
    oldWords: any[],
    newWordsList: string[],
    segStart: number,
    segEnd: number
  ): any[] => {
    if (newWordsList.length === 0) return [];

    const spokenOld = (oldWords || []).filter((w: any) => !w.isGap && w.word !== "");
    const N = newWordsList.length;
    const O = spokenOld.length;

    // 1. Align newWordsList to spokenOld using LCS (Longest Common Subsequence) / sequence matching
    const dp = Array.from({ length: O + 1 }, () => Array(N + 1).fill(0));
    for (let i = 0; i < O; i++) {
      for (let j = 0; j < N; j++) {
        if (spokenOld[i].word.toLowerCase() === newWordsList[j].toLowerCase()) {
          dp[i + 1][j + 1] = dp[i][j] + 1;
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    // Backtrack to find matched pairs (oldIdx -> newIdx)
    const matchedOldToNew = new Map<number, number>();
    const matchedNewToOld = new Map<number, number>();
    let i = O, j = N;
    while (i > 0 && j > 0) {
      if (spokenOld[i - 1].word.toLowerCase() === newWordsList[j - 1].toLowerCase()) {
        matchedOldToNew.set(i - 1, j - 1);
        matchedNewToOld.set(j - 1, i - 1);
        i--;
        j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    // Also handle 1-to-1 position mapping if word count is unchanged and unmatched at same position
    if (N === O) {
      for (let k = 0; k < N; k++) {
        if (!matchedNewToOld.has(k)) {
          matchedOldToNew.set(k, k);
          matchedNewToOld.set(k, k);
        }
      }
    }

    // 2. Assign initial target midpoints for each word in newWordsList
    const midpoints: (number | undefined)[] = new Array(N);

    // First, fill in midpoints for matched words
    for (let k = 0; k < N; k++) {
      if (matchedNewToOld.has(k)) {
        const oldIdx = matchedNewToOld.get(k)!;
        const w = spokenOld[oldIdx];
        midpoints[k] = (w.start + w.end) / 2;
      }
    }

    // Next, interpolate midpoints for unmatched (newly inserted) words
    for (let k = 0; k < N; k++) {
      if (midpoints[k] === undefined) {
        // Find previous known midpoint
        let prevMid = segStart;
        for (let p = k - 1; p >= 0; p--) {
          if (midpoints[p] !== undefined) {
            prevMid = midpoints[p]!;
            break;
          }
        }
        // Find next known midpoint
        let nextMid = segEnd;
        for (let n = k + 1; n < N; n++) {
          if (midpoints[n] !== undefined) {
            nextMid = midpoints[n]!;
            break;
          }
        }
        // Count how many consecutive unmatched words are in this gap
        let gapStart = k;
        while (gapStart > 0 && midpoints[gapStart - 1] === undefined) gapStart--;
        let gapEnd = k;
        while (gapEnd < N - 1 && midpoints[gapEnd + 1] === undefined) gapEnd++;

        const gapCount = gapEnd - gapStart + 1;
        const posInGap = k - gapStart + 1;
        const gapStep = (nextMid - prevMid) / (gapCount + 1);
        midpoints[k] = prevMid + posInGap * gapStep;
      }
    }

    // Ensure midpoints are strictly increasing
    const totalDur = Math.max(0.1, segEnd - segStart);
    const minMidGap = Math.min(0.04, totalDur / (N + 1));
    for (let k = 1; k < N; k++) {
      if (midpoints[k]! <= midpoints[k - 1]!) {
        midpoints[k] = midpoints[k - 1]! + minMidGap;
      }
    }

    // 3. Compute non-overlapping boundary points T[0..N] where T[0]=segStart and T[N]=segEnd
    const T: number[] = new Array(N + 1);
    T[0] = segStart;
    T[N] = segEnd;

    for (let k = 1; k < N; k++) {
      T[k] = (midpoints[k - 1]! + midpoints[k]!) / 2;
    }

    // 4. Relax boundary points so every word has at least minWordDur width
    const minWordDur = Math.min(0.06, totalDur / N);

    // Forward pass (push right)
    for (let k = 1; k < N; k++) {
      if (T[k] < T[k - 1] + minWordDur) {
        T[k] = T[k - 1] + minWordDur;
      }
    }

    // Backward pass (push left)
    for (let k = N - 1; k >= 1; k--) {
      if (T[k] > T[k + 1] - minWordDur) {
        T[k] = T[k + 1] - minWordDur;
      }
    }

    // Fallback if boundaries overflowed: uniform spacing
    if (T[1] < T[0] + 0.01 || T[N - 1] > T[N] - 0.01) {
      const step = totalDur / N;
      for (let k = 1; k < N; k++) {
        T[k] = segStart + k * step;
      }
    }

    // Enforce exact stickiness at edges
    T[0] = segStart;
    T[N] = segEnd;

    // 5. Construct final word objects
    const result: any[] = [];
    for (let k = 0; k < N; k++) {
      const wordText = newWordsList[k];
      let score = 1.0;
      if (matchedNewToOld.has(k)) {
        const oldIdx = matchedNewToOld.get(k)!;
        score = spokenOld[oldIdx].score ?? 1.0;
      }

      result.push({
        word: wordText,
        start: T[k],
        end: T[k + 1],
        score: score,
        isGap: false,
        deleted: false,
      });
    }

    return result;
  };

  const handleSegmentChange = (index: number, newText: string) => {
    updateSegments((prev) => {
      const newSegments = [...prev];
      const segment = { ...newSegments[index], text: newText };
      
      const newWordsList = newText.trim().split(/\s+/).filter(Boolean);
      segment.words = alignAndRetimeWords(
        segment.words || [],
        newWordsList,
        segment.start,
        segment.end
      );
      
      newSegments[index] = segment;
      return newSegments;
    });
  };

  const handleToggleWordDelete = (segmentIndex: number, wordIndex: number) => {
    updateSegments((prev) => {
      const newSegments = [...prev];
      const segment = { ...newSegments[segmentIndex] };
      if (segment.words) {
        const words = [...segment.words];
        const word = { ...words[wordIndex] };
        word.deleted = !word.deleted;
        words[wordIndex] = word;
        segment.words = words;
      }
      newSegments[segmentIndex] = segment;
      return newSegments;
    });
  };

  const handleToggleSegmentSilence = (segmentIndex: number) => {
    updateSegments((prev) => {
      const newSegments = [...prev];
      const segment = { ...newSegments[segmentIndex] };
      if (segment.words) {
        const realWords = segment.words.filter((w: any) => !w.isGap);
        const allSpokenDeleted = realWords.every((w: any) => w.deleted);
        const shouldDelete = !allSpokenDeleted;

        segment.words = segment.words.map((w: any) => ({
          ...w,
          deleted: shouldDelete,
        }));
      }
      newSegments[segmentIndex] = segment;
      return newSegments;
    });
  };

  const handleAutoCutSilences = () => {
    updateSegments((prev) => {
      const deletes: { start: number; end: number }[] = [];
      
      // Check space before the first segment
      if (prev.length > 0 && prev[0].start >= silenceThreshold) {
        deletes.push({ start: 0, end: prev[0].start });
      }

      // Check spaces between segments
      for (let i = 0; i < prev.length - 1; i++) {
        const gap = prev[i + 1].start - prev[i].end;
        if (gap >= silenceThreshold) {
          deletes.push({ start: prev[i].end, end: prev[i + 1].start });
        }
      }

      if (deletes.length > 0) {
        setRippleDeletes((prevDeletes) => [...prevDeletes, ...deletes]);
      }
      return prev;
    });
  };

  const handleMergeSegments = (index1: number, index2: number) => {
    updateSegments((prev) => {
      const minIndex = Math.min(index1, index2);
      const maxIndex = Math.max(index1, index2);

      const newSegments = [...prev];
      const first = newSegments[minIndex];
      const second = newSegments[maxIndex];

      newSegments[minIndex] = {
        ...first,
        end: second.end,
        text: `${first.text.trim()} ${second.text.trim()}`.trim(),
        words:
          first.words && second.words
            ? [...first.words, ...second.words]
            : first.words || second.words,
      };

      newSegments.splice(maxIndex, 1);
      return newSegments;
    });
  };

  const handleDeleteSegments = (indices: number[]) => {
    updateSegments((prev) => prev.filter((_, i) => !indices.includes(i)));
  };

  const handleLiftDelete = (indices: (number | string)[]) => {
    updateSegments((prev) => {
      const newSegments = [...prev];
      indices.forEach((idx) => {
        if (typeof idx === "number" && newSegments[idx]) {
          newSegments[idx] = { ...newSegments[idx] };
          if (newSegments[idx].words) {
            newSegments[idx].words = newSegments[idx].words.map((w: any) => ({ ...w, deleted: true }));
          }
        } else if (typeof idx === "string" && (idx.startsWith("gap:") || idx.startsWith("word:"))) {
          const [, sIdx, wIdx] = idx.split(":").map(Number);
          if (newSegments[sIdx] && newSegments[sIdx].words && newSegments[sIdx].words[wIdx]) {
            newSegments[sIdx] = { ...newSegments[sIdx] };
            newSegments[sIdx].words = [...newSegments[sIdx].words];
            newSegments[sIdx].words[wIdx] = { ...newSegments[sIdx].words[wIdx], deleted: true };
          }
        }
      });
      return newSegments;
    });
  };

  const toTimelineTime = (mediaTime: number) => {
    const activeSeg = videoSegments.find(s => mediaTime >= s.sourceStart && mediaTime <= s.sourceEnd && !s.deleted);
    if (activeSeg) {
      return activeSeg.timelineStart + (mediaTime - activeSeg.sourceStart);
    }
    const closest = [...videoSegments].filter(s => !s.deleted).sort((a, b) => Math.abs(a.sourceStart - mediaTime) - Math.abs(b.sourceStart - mediaTime))[0];
    if (closest) {
      return closest.timelineStart + (mediaTime - closest.sourceStart);
    }
    return mediaTime;
  };

  // Helper: applies timeline-range ripple deletion to a track's segment list,
  // trimming or splitting overlapping segments and shifting subsequent segments left.
  const rippleDeleteTrackSegments = <T extends { id: string; timelineStart: number; timelineEnd: number; sourceStart: number; sourceEnd: number; deleted?: boolean; [key: string]: any }>(
    prev: T[],
    ranges: { timelineStart: number; timelineEnd: number }[]
  ): T[] => {
    if (!prev || prev.length === 0 || !ranges || ranges.length === 0) return prev || [];
    let current = [...prev];
    const sortedRanges = [...ranges].filter(r => r.timelineEnd > r.timelineStart).sort((a, b) => b.timelineStart - a.timelineStart);

    for (const { timelineStart: dStart, timelineEnd: dEnd } of sortedRanges) {
      const delta = dEnd - dStart;
      const nextList: T[] = [];

      for (const seg of current) {
        if (seg.deleted) {
          nextList.push(seg);
          continue;
        }

        // Entirely before deleted range -> unchanged
        if (seg.timelineEnd <= dStart + 0.001) {
          nextList.push(seg);
          continue;
        }

        // Entirely after deleted range -> shift left by delta
        if (seg.timelineStart >= dEnd - 0.001) {
          nextList.push({
            ...seg,
            timelineStart: seg.timelineStart - delta,
            timelineEnd: seg.timelineEnd - delta,
          });
          continue;
        }

        // Completely inside deleted range -> mark deleted
        if (seg.timelineStart >= dStart - 0.001 && seg.timelineEnd <= dEnd + 0.001) {
          nextList.push({ ...seg, deleted: true });
          continue;
        }

        // Spans across the deleted range (starts before dStart, ends after dEnd) -> split into left and right
        if (seg.timelineStart < dStart && seg.timelineEnd > dEnd) {
          const segDur = seg.timelineEnd - seg.timelineStart;
          const srcDur = seg.sourceEnd - seg.sourceStart;
          const leftRatio = (dStart - seg.timelineStart) / segDur;
          const rightRatio = (dEnd - seg.timelineStart) / segDur;

          const leftSrcEnd = seg.sourceStart + leftRatio * srcDur;
          const rightSrcStart = seg.sourceStart + rightRatio * srcDur;

          const leftSeg: T = {
            ...seg,
            timelineEnd: dStart,
            sourceEnd: leftSrcEnd,
          };
          const rightSeg: T = {
            ...seg,
            id: seg.id + '_r' + Math.random().toString(36).substr(2, 4),
            timelineStart: dStart,
            timelineEnd: seg.timelineEnd - delta,
            sourceStart: rightSrcStart,
          };

          nextList.push(leftSeg, rightSeg);
          continue;
        }

        // Starts before dStart and ends inside [dStart, dEnd] -> trim end to dStart
        if (seg.timelineStart < dStart && seg.timelineEnd <= dEnd) {
          const segDur = seg.timelineEnd - seg.timelineStart;
          const srcDur = seg.sourceEnd - seg.sourceStart;
          const ratio = (dStart - seg.timelineStart) / segDur;
          const newSrcEnd = seg.sourceStart + ratio * srcDur;

          nextList.push({
            ...seg,
            timelineEnd: dStart,
            sourceEnd: newSrcEnd,
          });
          continue;
        }

        // Starts inside [dStart, dEnd] and ends after dEnd -> trim start to dStart, shift end left
        if (seg.timelineStart >= dStart && seg.timelineEnd > dEnd) {
          const segDur = seg.timelineEnd - seg.timelineStart;
          const srcDur = seg.sourceEnd - seg.sourceStart;
          const ratio = (dEnd - seg.timelineStart) / segDur;
          const newSrcStart = seg.sourceStart + ratio * srcDur;

          nextList.push({
            ...seg,
            timelineStart: dStart,
            timelineEnd: seg.timelineEnd - delta,
            sourceStart: newSrcStart,
          });
          continue;
        }

        nextList.push(seg);
      }

      current = nextList;
    }

    return current;
  };

  const handleRippleDelete = (indices: (number | string)[]) => {
    const regionsToAdd: { start: number; end: number }[] = [];
    const segmentIndicesToDelete: number[] = [];
    const timelineRanges: { timelineStart: number; timelineEnd: number }[] = [];

    indices.forEach((idx) => {
      if (typeof idx === "number") {
        segmentIndicesToDelete.push(idx);
        if (editableSegments[idx]) {
          const seg = editableSegments[idx];
          regionsToAdd.push({ start: seg.start, end: seg.end });
          const tlStart = toTimelineTime(seg.start);
          const tlEnd = toTimelineTime(seg.end);
          timelineRanges.push({ timelineStart: tlStart, timelineEnd: tlEnd });
        }
      } else if (typeof idx === "string" && (idx.startsWith("gap:") || idx.startsWith("word:"))) {
        const [, sIdx, wIdx] = idx.split(":").map(Number);
        if (editableSegments[sIdx] && editableSegments[sIdx].words && editableSegments[sIdx].words[wIdx]) {
          const word = editableSegments[sIdx].words[wIdx];
          regionsToAdd.push({ start: word.start, end: word.end });
          const tlStart = toTimelineTime(word.start);
          const tlEnd = toTimelineTime(word.end);
          timelineRanges.push({ timelineStart: tlStart, timelineEnd: tlEnd });
        }
      }
    });

    if (regionsToAdd.length === 0) return;

    const newRippleDeletes = [...rippleDeletes, ...regionsToAdd];
    let newSegments = [...editableSegments];
    
    indices.forEach((idx) => {
      if (typeof idx === "string" && (idx.startsWith("gap:") || idx.startsWith("word:"))) {
        const [, sIdx, wIdx] = idx.split(":").map(Number);
        if (newSegments[sIdx] && newSegments[sIdx].words) {
          const segment = { ...newSegments[sIdx] };
          const words = [...segment.words!];
          words[wIdx] = { ...words[wIdx], deleted: true };
          segment.words = words;
          newSegments[sIdx] = segment;
        }
      }
    });

    if (segmentIndicesToDelete.length > 0) {
      newSegments = newSegments.filter((_, i) => !segmentIndicesToDelete.includes(i));
    }

    setSegmentHistory((prevHistory) => ({
      past: [...prevHistory.past, cloneState(editableSegments, rippleDeletes, videoSegments, audioSegments)].slice(-50),
      future: [],
    }));
    
    // Trim remaining subtitles that partially overlap the deleted regions
    newSegments = trimSubtitlesByRegions(newSegments, regionsToAdd);
    setEditableSegments(newSegments);
    setRippleDeletes(newRippleDeletes);

    setVideoSegments(prev => rippleDeleteTrackSegments(prev, timelineRanges));
    setAudioSegments(prev => {
      const baseAudio = prev && prev.length > 0 ? prev : videoSegments.map(v => ({
        id: v.id + '_a',
        sourceStart: v.sourceStart,
        sourceEnd: v.sourceEnd,
        timelineStart: v.timelineStart,
        timelineEnd: v.timelineEnd,
        deleted: v.deleted,
        linkedVideoId: v.id,
      }));
      return rippleDeleteTrackSegments(baseAudio, timelineRanges);
    });
  };

  const handleRippleDeleteRange = (start: number, end: number) => {
    const newRippleDeletes = [...rippleDeletes, { start, end }];
    setSegmentHistory((prevHistory) => ({
      past: [...prevHistory.past, cloneState(editableSegments, rippleDeletes, videoSegments, audioSegments)].slice(-50),
      future: [],
    }));
    // Trim subtitles that overlap the deleted range
    const trimmedSegments = trimSubtitlesByRegions(editableSegments, [{ start, end }]);
    setEditableSegments(trimmedSegments);
    setRippleDeletes(newRippleDeletes);

    const timelineRanges = [{ timelineStart: start, timelineEnd: end }];
    setVideoSegments(prev => rippleDeleteTrackSegments(prev, timelineRanges));
    setAudioSegments(prev => {
      const baseAudio = prev && prev.length > 0 ? prev : videoSegments.map(v => ({
        id: v.id + '_a',
        sourceStart: v.sourceStart,
        sourceEnd: v.sourceEnd,
        timelineStart: v.timelineStart,
        timelineEnd: v.timelineEnd,
        deleted: v.deleted,
        linkedVideoId: v.id,
      }));
      return rippleDeleteTrackSegments(baseAudio, timelineRanges);
    });
  };

  const undo = () => {
    if (segmentHistory.past.length === 0) return;
    const previous = segmentHistory.past[segmentHistory.past.length - 1];
    const newPast = segmentHistory.past.slice(0, segmentHistory.past.length - 1);
    const newFuture = [cloneState(editableSegments, rippleDeletes, videoSegments, audioSegments), ...segmentHistory.future];
    
    setEditableSegments(previous.segments || []);
    setRippleDeletes(previous.rippleDeletes || []);
    if (previous.videoSegments) setVideoSegments(previous.videoSegments);
    if (previous.audioSegments) setAudioSegments(previous.audioSegments);
    setSegmentHistory({ past: newPast, future: newFuture });
  };

  const redo = () => {
    if (segmentHistory.future.length === 0) return;
    const next = segmentHistory.future[0];
    const newFuture = segmentHistory.future.slice(1);
    const newPast = [...segmentHistory.past, cloneState(editableSegments, rippleDeletes, videoSegments, audioSegments)];
    
    setEditableSegments(next.segments || []);
    setRippleDeletes(next.rippleDeletes || []);
    if (next.videoSegments) setVideoSegments(next.videoSegments);
    if (next.audioSegments) setAudioSegments(next.audioSegments);
    setSegmentHistory({ past: newPast, future: newFuture });
  };

  const handleDuplicateSegment = (index: number) => {
    updateSegments((prev) => {
      const newSegments = [...prev];
      const target = newSegments[index];

      const textWords = target.text.trim().split(/\s+/);
      const textMid = Math.max(1, Math.ceil(textWords.length / 2));
      const firstText = textWords.slice(0, textMid).join(" ");
      const secondText = textWords.slice(textMid).join(" ");

      let splitTime = target.start + (target.end - target.start) / 2;
      let firstWords = target.words;
      let secondWords = target.words;

      if (target.words && target.words.length > 1) {
        const wordMid = Math.max(1, Math.ceil(target.words.length / 2));
        const midpointWord = target.words[wordMid - 1];
        if (midpointWord && midpointWord.end) {
          splitTime = midpointWord.end;
        } else if (midpointWord && midpointWord.start) {
          splitTime = midpointWord.start;
        }
        firstWords = target.words.slice(0, wordMid);
        secondWords = target.words.slice(wordMid);
      }

      const firstHalf = { ...target, end: splitTime, text: firstText, words: firstWords };
      const secondHalf = { ...target, start: splitTime, text: secondText, words: secondWords };

      newSegments.splice(index, 1, firstHalf, secondHalf);
      return newSegments;
    });
  };

  const handleOffsetSegments = (offsetSeconds: number) => {
    updateSegments((prev) => {
      return prev.map((segment) => {
        const offsetWords = segment.words
          ? segment.words.map((w: any) => ({
              ...w,
              start: Math.max(0, (w.start || 0) + offsetSeconds),
              end: Math.max(0, (w.end || 0) + offsetSeconds),
            }))
          : segment.words;

        return {
          ...segment,
          start: Math.max(0, segment.start + offsetSeconds),
          end: Math.max(0, segment.end + offsetSeconds),
          words: offsetWords,
        };
      });
    });
  };

  const handleVideoCut = (time: number) => {
    setSegmentHistory((prevHistory) => ({
      past: [...prevHistory.past, cloneState(editableSegments, rippleDeletes, videoSegments, audioSegments)].slice(-50),
      future: [],
    }));

    const cutVideoId = Math.random().toString(36).substr(2, 9);

    setVideoSegments((prev) => {
      const newSegments = [...prev];
      const targetIndex = newSegments.findIndex(s => time > s.timelineStart && time < s.timelineEnd);
      if (targetIndex !== -1) {
        const target = newSegments[targetIndex];
        const timelineRatio = (time - target.timelineStart) / (target.timelineEnd - target.timelineStart);
        const sourceTime = target.sourceStart + timelineRatio * (target.sourceEnd - target.sourceStart);
        
        const firstHalf: VideoSegment = { ...target, timelineEnd: time, sourceEnd: sourceTime };
        const secondHalf: VideoSegment = { ...target, id: cutVideoId, timelineStart: time, sourceStart: sourceTime };
        newSegments.splice(targetIndex, 1, firstHalf, secondHalf);
      }
      return newSegments;
    });

    if (isAudioLinked) {
      setAudioSegments((prev) => {
        let baseAudio = prev && prev.length > 0 ? [...prev] : videoSegments.map(v => ({
          id: v.id + '_a',
          sourceStart: v.sourceStart,
          sourceEnd: v.sourceEnd,
          timelineStart: v.timelineStart,
          timelineEnd: v.timelineEnd,
          deleted: v.deleted,
          linkedVideoId: v.id,
        }));

        const newSegments = [...baseAudio];
        const targetIndex = newSegments.findIndex(s => time > s.timelineStart && time < s.timelineEnd);
        if (targetIndex !== -1) {
          const target = newSegments[targetIndex];
          const timelineRatio = (time - target.timelineStart) / (target.timelineEnd - target.timelineStart);
          const sourceTime = target.sourceStart + timelineRatio * (target.sourceEnd - target.sourceStart);
          
          const firstHalf: AudioSegment = { ...target, timelineEnd: time, sourceEnd: sourceTime };
          const secondHalf: AudioSegment = { ...target, id: cutVideoId + '_a', timelineStart: time, sourceStart: sourceTime, linkedVideoId: cutVideoId };
          newSegments.splice(targetIndex, 1, firstHalf, secondHalf);
        }
        return newSegments;
      });
    }
  };

  const handleAudioCut = (time: number) => {
    setSegmentHistory((prevHistory) => ({
      past: [...prevHistory.past, cloneState(editableSegments, rippleDeletes, videoSegments, audioSegments)].slice(-50),
      future: [],
    }));

    const cutAudioId = Math.random().toString(36).substr(2, 9) + '_a';

    setAudioSegments((prev) => {
      let baseAudio = prev && prev.length > 0 ? [...prev] : videoSegments.map(v => ({
        id: v.id + '_a',
        sourceStart: v.sourceStart,
        sourceEnd: v.sourceEnd,
        timelineStart: v.timelineStart,
        timelineEnd: v.timelineEnd,
        deleted: v.deleted,
        linkedVideoId: v.id,
      }));

      const newSegments = [...baseAudio];
      const targetIndex = newSegments.findIndex(s => time > s.timelineStart && time < s.timelineEnd);
      if (targetIndex !== -1) {
        const target = newSegments[targetIndex];
        const timelineRatio = (time - target.timelineStart) / (target.timelineEnd - target.timelineStart);
        const sourceTime = target.sourceStart + timelineRatio * (target.sourceEnd - target.sourceStart);
        
        const firstHalf: AudioSegment = { ...target, timelineEnd: time, sourceEnd: sourceTime };
        const secondHalf: AudioSegment = { ...target, id: cutAudioId, timelineStart: time, sourceStart: sourceTime };
        newSegments.splice(targetIndex, 1, firstHalf, secondHalf);
      }
      return newSegments;
    });

    if (isAudioLinked) {
      setVideoSegments((prev) => {
        const newSegments = [...prev];
        const targetIndex = newSegments.findIndex(s => time > s.timelineStart && time < s.timelineEnd);
        if (targetIndex !== -1) {
          const target = newSegments[targetIndex];
          const timelineRatio = (time - target.timelineStart) / (target.timelineEnd - target.timelineStart);
          const sourceTime = target.sourceStart + timelineRatio * (target.sourceEnd - target.sourceStart);
          
          const firstHalf: VideoSegment = { ...target, timelineEnd: time, sourceEnd: sourceTime };
          const secondHalf: VideoSegment = { ...target, id: cutAudioId.replace('_a', ''), timelineStart: time, sourceStart: sourceTime };
          newSegments.splice(targetIndex, 1, firstHalf, secondHalf);
        }
        return newSegments;
      });
    }
  };

  const applyJCut = (splitTime: number, leadDuration: number = 1.0) => {
    setSegmentHistory((prevHistory) => ({
      past: [...prevHistory.past, cloneState(editableSegments, rippleDeletes, videoSegments, audioSegments)].slice(-50),
      future: [],
    }));

    setAudioSegments((prevAudio) => {
      // 1. Ensure audioSegments is initialized
      let currentAudio: AudioSegment[] = prevAudio && prevAudio.length > 0
        ? [...prevAudio]
        : videoSegments.map(v => ({
            id: v.id + '_a',
            sourceStart: v.sourceStart,
            sourceEnd: v.sourceEnd,
            timelineStart: v.timelineStart,
            timelineEnd: v.timelineEnd,
            deleted: v.deleted,
            linkedVideoId: v.id,
          }));

      let sorted = currentAudio.sort((a, b) => a.timelineStart - b.timelineStart);

      // 2. Find candidate cut boundaries from video and audio tracks
      const candidateBoundaries: number[] = [];
      videoSegments.filter(v => !v.deleted).forEach((v, i) => {
        if (i > 0) candidateBoundaries.push(v.timelineStart);
      });
      sorted.filter(a => !a.deleted).forEach((a, i) => {
        if (i > 0) candidateBoundaries.push(a.timelineStart);
      });

      // 3. Determine the best cut boundary point T
      let cutPoint = splitTime;
      if (candidateBoundaries.length > 0) {
        const closest = candidateBoundaries.reduce((prev, curr) =>
          Math.abs(curr - splitTime) < Math.abs(prev - splitTime) ? curr : prev
        );
        // If within 10s or if only 1 cut exists, pick this edit boundary
        if (Math.abs(closest - splitTime) < 10.0 || candidateBoundaries.length === 1) {
          cutPoint = closest;
        }
      }

      // 4. Find audio segment starting at or closest to cutPoint
      let targetIdx = sorted.findIndex(s => !s.deleted && Math.abs(s.timelineStart - cutPoint) < 0.2);

      // If no audio segment starts at cutPoint, split the spanning audio segment
      if (targetIdx === -1) {
        const spanIdx = sorted.findIndex(s => !s.deleted && s.timelineStart < cutPoint - 0.05 && s.timelineEnd > cutPoint + 0.05);
        if (spanIdx !== -1) {
          const target = sorted[spanIdx];
          const dur = target.timelineEnd - target.timelineStart;
          const ratio = (cutPoint - target.timelineStart) / dur;
          const srcCut = target.sourceStart + ratio * (target.sourceEnd - target.sourceStart);
          
          const leftHalf: AudioSegment = { ...target, timelineEnd: cutPoint, sourceEnd: srcCut };
          const rightHalf: AudioSegment = { ...target, id: Math.random().toString(36).substr(2, 9) + '_a', timelineStart: cutPoint, sourceStart: srcCut };
          
          sorted.splice(spanIdx, 1, leftHalf, rightHalf);
          targetIdx = spanIdx + 1;
        }
      }

      if (targetIdx <= 0 || targetIdx >= sorted.length) return sorted;

      const incoming = sorted[targetIdx];
      const outgoing = sorted[targetIdx - 1];

      if (outgoing.deleted || incoming.deleted) return sorted;

      const maxLead = Math.min(leadDuration, (outgoing.timelineEnd - outgoing.timelineStart) * 0.8, incoming.sourceStart > 0 ? incoming.sourceStart : leadDuration);
      const actualLead = Math.max(0.1, maxLead > 0 ? maxLead : Math.min(leadDuration, 1.0));

      const newBoundary = cutPoint - actualLead;

      sorted[targetIdx] = {
        ...incoming,
        timelineStart: newBoundary,
        sourceStart: Math.max(0, incoming.sourceStart - actualLead),
      };

      sorted[targetIdx - 1] = {
        ...outgoing,
        timelineEnd: newBoundary,
        sourceEnd: Math.max(outgoing.sourceStart + 0.05, outgoing.sourceEnd - actualLead),
      };

      return [...sorted];
    });
  };

  const applyLCut = (splitTime: number, lagDuration: number = 1.0) => {
    setSegmentHistory((prevHistory) => ({
      past: [...prevHistory.past, cloneState(editableSegments, rippleDeletes, videoSegments, audioSegments)].slice(-50),
      future: [],
    }));

    setAudioSegments((prevAudio) => {
      let currentAudio: AudioSegment[] = prevAudio && prevAudio.length > 0
        ? [...prevAudio]
        : videoSegments.map(v => ({
            id: v.id + '_a',
            sourceStart: v.sourceStart,
            sourceEnd: v.sourceEnd,
            timelineStart: v.timelineStart,
            timelineEnd: v.timelineEnd,
            deleted: v.deleted,
            linkedVideoId: v.id,
          }));

      let sorted = currentAudio.sort((a, b) => a.timelineStart - b.timelineStart);

      const candidateBoundaries: number[] = [];
      videoSegments.filter(v => !v.deleted).forEach((v, i) => {
        if (i > 0) candidateBoundaries.push(v.timelineStart);
      });
      sorted.filter(a => !a.deleted).forEach((a, i) => {
        if (i > 0) candidateBoundaries.push(a.timelineStart);
      });

      let cutPoint = splitTime;
      if (candidateBoundaries.length > 0) {
        const closest = candidateBoundaries.reduce((prev, curr) =>
          Math.abs(curr - splitTime) < Math.abs(prev - splitTime) ? curr : prev
        );
        if (Math.abs(closest - splitTime) < 10.0 || candidateBoundaries.length === 1) {
          cutPoint = closest;
        }
      }

      let targetIdx = sorted.findIndex(s => !s.deleted && Math.abs(s.timelineStart - cutPoint) < 0.2);

      if (targetIdx === -1) {
        const spanIdx = sorted.findIndex(s => !s.deleted && s.timelineStart < cutPoint - 0.05 && s.timelineEnd > cutPoint + 0.05);
        if (spanIdx !== -1) {
          const target = sorted[spanIdx];
          const dur = target.timelineEnd - target.timelineStart;
          const ratio = (cutPoint - target.timelineStart) / dur;
          const srcCut = target.sourceStart + ratio * (target.sourceEnd - target.sourceStart);
          
          const leftHalf: AudioSegment = { ...target, timelineEnd: cutPoint, sourceEnd: srcCut };
          const rightHalf: AudioSegment = { ...target, id: Math.random().toString(36).substr(2, 9) + '_a', timelineStart: cutPoint, sourceStart: srcCut };
          
          sorted.splice(spanIdx, 1, leftHalf, rightHalf);
          targetIdx = spanIdx + 1;
        }
      }

      if (targetIdx <= 0 || targetIdx >= sorted.length) return sorted;

      const incoming = sorted[targetIdx];
      const outgoing = sorted[targetIdx - 1];

      if (outgoing.deleted || incoming.deleted) return sorted;

      const maxLag = Math.min(lagDuration, (incoming.timelineEnd - incoming.timelineStart) * 0.8);
      const actualLag = Math.max(0.1, maxLag > 0 ? maxLag : Math.min(lagDuration, 1.0));

      const newBoundary = cutPoint + actualLag;

      sorted[targetIdx - 1] = {
        ...outgoing,
        timelineEnd: newBoundary,
        sourceEnd: outgoing.sourceEnd + actualLag,
      };

      sorted[targetIdx] = {
        ...incoming,
        timelineStart: newBoundary,
        sourceStart: incoming.sourceStart + actualLag,
      };

      return [...sorted];
    });
  };

  const handleVideoDelete = (ids: string[]) => {
    updateVideoSegments((prev) => {
      return prev.map(s => ids.includes(s.id) ? { ...s, deleted: true } : s);
    });
    if (isAudioLinked) {
      updateAudioSegments((prev) => {
        return prev.map(s => (ids.includes(s.id) || (s.linkedVideoId && ids.includes(s.linkedVideoId)) || ids.includes(s.id.replace('_a', ''))) ? { ...s, deleted: true } : s);
      });
    }
  };

  const handleAudioDelete = (ids: string[]) => {
    updateAudioSegments((prev) => {
      return prev.map(s => ids.includes(s.id) ? { ...s, deleted: true } : s);
    });
    if (isAudioLinked) {
      updateVideoSegments((prev) => {
        return prev.map(s => (ids.includes(s.id) || ids.includes(s.id + '_a') || (ids.some(aid => aid.replace('_a', '') === s.id))) ? { ...s, deleted: true } : s);
      });
    }
  };

  const handleVideoRippleDelete = (ids: string[]) => {
    const targetSegments = videoSegments.filter(s => ids.includes(s.id) && !s.deleted);
    if (targetSegments.length === 0) return;

    setSegmentHistory((prevHistory) => ({
      past: [...prevHistory.past, cloneState(editableSegments, rippleDeletes, videoSegments, audioSegments)].slice(-50),
      future: [],
    }));

    const timelineRanges = targetSegments.map(s => ({ timelineStart: s.timelineStart, timelineEnd: s.timelineEnd }));
    const regionsToAdd = targetSegments.map(s => ({ start: s.sourceStart, end: s.sourceEnd }));

    setVideoSegments(prev => rippleDeleteTrackSegments(prev, timelineRanges));
    setAudioSegments(prev => {
      const baseAudio = prev && prev.length > 0 ? prev : videoSegments.map(v => ({
        id: v.id + '_a',
        sourceStart: v.sourceStart,
        sourceEnd: v.sourceEnd,
        timelineStart: v.timelineStart,
        timelineEnd: v.timelineEnd,
        deleted: v.deleted,
        linkedVideoId: v.id,
      }));
      return rippleDeleteTrackSegments(baseAudio, timelineRanges);
    });

    setRippleDeletes((prev) => [...prev, ...regionsToAdd]);
    setEditableSegments((prevSegments) => trimSubtitlesByRegions(prevSegments, regionsToAdd));
  };

  const handleAudioRippleDelete = (ids: string[]) => {
    const baseAudio = audioSegments && audioSegments.length > 0 ? audioSegments : videoSegments.map(v => ({
      id: v.id + '_a',
      sourceStart: v.sourceStart,
      sourceEnd: v.sourceEnd,
      timelineStart: v.timelineStart,
      timelineEnd: v.timelineEnd,
      deleted: v.deleted,
      linkedVideoId: v.id,
    }));

    const targetSegments = baseAudio.filter(s => ids.includes(s.id) && !s.deleted);
    if (targetSegments.length === 0) return;

    setSegmentHistory((prevHistory) => ({
      past: [...prevHistory.past, cloneState(editableSegments, rippleDeletes, videoSegments, audioSegments)].slice(-50),
      future: [],
    }));

    const timelineRanges = targetSegments.map(s => ({ timelineStart: s.timelineStart, timelineEnd: s.timelineEnd }));
    const regionsToAdd = targetSegments.map(s => ({ start: s.sourceStart, end: s.sourceEnd }));

    setAudioSegments(prev => rippleDeleteTrackSegments(baseAudio, timelineRanges));
    setVideoSegments(prev => rippleDeleteTrackSegments(prev, timelineRanges));

    setRippleDeletes((prev) => [...prev, ...regionsToAdd]);
    setEditableSegments((prevSegments) => trimSubtitlesByRegions(prevSegments, regionsToAdd));
  };

  const handleClearTrack = (trackType: 'subtitle' | 'video' | 'audio') => {
    if (trackType === 'subtitle') {
      updateSegments([]);
    } else if (trackType === 'video') {
      updateVideoSegments([]);
    } else {
      updateAudioSegments([]);
    }
  };

  const handleSubtitleCutAtTime = (mediaTime: number) => {
    updateSegments((prev) => {
      const targetIndex = prev.findIndex(s => mediaTime > s.start && mediaTime < s.end);
      if (targetIndex === -1) return prev;
      const target = prev[targetIndex];

      let firstWords = target.words;
      let secondWords = target.words;

      if (target.words && target.words.length > 0) {
        firstWords = target.words.filter((w: any) => (w.end || w.start || 0) <= mediaTime).map((w: any) => ({ ...w }));
        secondWords = target.words.filter((w: any) => (w.start || w.end || 0) > mediaTime).map((w: any) => ({ ...w }));

        if (firstWords.length > 0) {
          firstWords[firstWords.length - 1].end = mediaTime;
        }
        if (secondWords.length > 0) {
          secondWords[0].start = mediaTime;
        }
      }

      const firstText = firstWords ? firstWords.map((w: any) => w.text || w.word).join(" ") : target.text;
      const secondText = secondWords ? secondWords.map((w: any) => w.text || w.word).join(" ") : target.text;

      const firstHalf = { ...target, end: mediaTime, text: firstText || target.text, words: firstWords };
      const secondHalf = { ...target, start: mediaTime, text: secondText || target.text, words: secondWords, id: Math.random().toString(36).substr(2, 9) };

      const newSegments = [...prev];
      newSegments.splice(targetIndex, 1, firstHalf, secondHalf);
      return newSegments;
    });
  };

  const handleToggleAudioMute = (ids: string[]) => {
    setSegmentHistory((prevHistory) => ({
      past: [...prevHistory.past, cloneState(editableSegments, rippleDeletes, videoSegments, audioSegments)].slice(-50),
      future: [],
    }));

    setAudioSegments((prevAudio) => {
      const base: AudioSegment[] = prevAudio && prevAudio.length > 0 ? prevAudio : videoSegments.map(v => ({
        id: v.id + '_a',
        sourceStart: v.sourceStart,
        sourceEnd: v.sourceEnd,
        timelineStart: v.timelineStart,
        timelineEnd: v.timelineEnd,
        deleted: v.deleted,
        muted: false,
        linkedVideoId: v.id,
      }));
      return base.map(s => ids.includes(s.id) ? { ...s, muted: !s.muted } : s);
    });
  };

  return {
    editableSegments,
    setEditableSegments,
    selectedIndexes,
    setSelectedIndexes,
    videoSegments,
    setVideoSegments,
    selectedVideoIndexes,
    setSelectedVideoIndexes,
    audioSegments,
    setAudioSegments,
    selectedAudioIndexes,
    setSelectedAudioIndexes,
    isAudioLinked,
    setIsAudioLinked,
    cursorMode,
    setCursorMode,
    rippleDeletes,
    setRippleDeletes,
    undo,
    redo,
    segmentHistory,
    setSegmentHistory,
    updateSegments,
    updateVideoSegments,
    updateAudioSegments,
    handleResegment,
    handleSegmentChange,
    handleToggleWordDelete,
    handleToggleSegmentSilence,
    handleAutoCutSilences,
    handleMergeSegments,
    handleDeleteSegments,
    handleLiftDelete,
    handleRippleDelete,
    handleRippleDeleteRange,
    handleDuplicateSegment,
    handleOffsetSegments,
    handleSubtitleCutAtTime,
    handleVideoCut,
    handleAudioCut,
    applyJCut,
    applyLCut,
    handleVideoDelete,
    handleAudioDelete,
    handleVideoRippleDelete,
    handleAudioRippleDelete,
    handleToggleAudioMute,
    handleClearTrack,
  };
}

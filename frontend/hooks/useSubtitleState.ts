import { useState } from "react";
import { resegmentTranscripts } from "@/lib/chunking";
import { set as idbSet } from "idb-keyval";

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
}

type HistoryState = { 
  segments: any[]; 
  rippleDeletes: { start: number; end: number }[];
  videoSegments: VideoSegment[];
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
  const [cursorMode, setCursorMode] = useState<'select' | 'cut'>('select');

  const [rippleDeletes, setRippleDeletes] = useState<{ start: number; end: number }[]>([]);
  const [segmentHistory, setSegmentHistory] = useState<{ past: HistoryState[]; future: HistoryState[] }>({
    past: [],
    future: [],
  });

  const updateSegments = (newSegments: any[] | ((prev: any[]) => any[])) => {
    setEditableSegments((prevSegments) => {
      const updated = typeof newSegments === "function" ? newSegments(prevSegments) : newSegments;
      setSegmentHistory((prevHistory) => ({
        past: [...prevHistory.past, { segments: prevSegments, rippleDeletes: [...rippleDeletes], videoSegments: [...videoSegments] }].slice(-50),
        future: [],
      }));
      return updated;
    });
  };

  const updateVideoSegments = (newVideoSegments: VideoSegment[] | ((prev: VideoSegment[]) => VideoSegment[])) => {
    setVideoSegments((prevSegments) => {
      const updated = typeof newVideoSegments === "function" ? newVideoSegments(prevSegments) : newVideoSegments;
      setSegmentHistory((prevHistory) => ({
        past: [...prevHistory.past, { segments: [...editableSegments], rippleDeletes: [...rippleDeletes], videoSegments: prevSegments }].slice(-50),
        future: [],
      }));
      return updated;
    });
  };

  const handleResegment = (maxWords: string) => {
    if (!result || !result.raw_segments) return;
    const newSegments = resegmentTranscripts(result.raw_segments, maxWords);
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

  const handleSegmentChange = (index: number, newText: string) => {
    updateSegments((prev) => {
      const newSegments = [...prev];
      const segment = { ...newSegments[index], text: newText };
      
      if (segment.words) {
        const newWordsList = newText.trim().split(/\s+/).filter(Boolean);
        const updatedWords = [...segment.words];
        
        let newIdx = 0;
        for (let i = 0; i < updatedWords.length; i++) {
          if (!updatedWords[i].isGap) {
            if (newIdx < newWordsList.length) {
              updatedWords[i] = { ...updatedWords[i], word: newWordsList[newIdx] };
              newIdx++;
            } else {
              updatedWords[i] = { ...updatedWords[i], word: "" };
            }
          }
        }
        
        if (newIdx < newWordsList.length) {
          const lastValidWord = updatedWords.slice().reverse().find((w) => !w.isGap);
          const start = lastValidWord ? lastValidWord.end : segment.start;
          const end = segment.end;
          
          while (newIdx < newWordsList.length) {
            updatedWords.push({
              word: newWordsList[newIdx],
              start: start,
              end: end,
              score: 1.0,
              isGap: false,
              deleted: false
            });
            newIdx++;
          }
        }
        
        segment.words = updatedWords.filter((w: any) => w.isGap || w.word !== "");
      }
      
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

  const handleRippleDelete = (indices: (number | string)[]) => {
    const regionsToAdd: { start: number; end: number }[] = [];
    const segmentIndicesToDelete: number[] = [];

    indices.forEach((idx) => {
      if (typeof idx === "number") {
        segmentIndicesToDelete.push(idx);
        if (editableSegments[idx]) {
          regionsToAdd.push({ start: editableSegments[idx].start, end: editableSegments[idx].end });
        }
      } else if (typeof idx === "string" && (idx.startsWith("gap:") || idx.startsWith("word:"))) {
        const [, sIdx, wIdx] = idx.split(":").map(Number);
        if (editableSegments[sIdx] && editableSegments[sIdx].words && editableSegments[sIdx].words[wIdx]) {
          const word = editableSegments[sIdx].words[wIdx];
          regionsToAdd.push({ start: word.start, end: word.end });
        }
      }
    });

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
      past: [...prevHistory.past, { segments: editableSegments, rippleDeletes, videoSegments }].slice(-50),
      future: [],
    }));
    
    setEditableSegments(newSegments);
    setRippleDeletes(newRippleDeletes);
  };

  const handleRippleDeleteRange = (start: number, end: number) => {
    setSegmentHistory((prevHistory) => ({
      past: [...prevHistory.past, { segments: editableSegments, rippleDeletes, videoSegments }].slice(-50),
      future: [],
    }));
    setRippleDeletes((prev) => [...prev, { start, end }]);
  };

  const undo = () => {
    if (segmentHistory.past.length === 0) return;
    const previous = segmentHistory.past[segmentHistory.past.length - 1];
    const newPast = segmentHistory.past.slice(0, segmentHistory.past.length - 1);
    const newFuture = [{ segments: editableSegments, rippleDeletes, videoSegments }, ...segmentHistory.future];
    
    setEditableSegments(previous.segments);
    setRippleDeletes(previous.rippleDeletes);
    setVideoSegments(previous.videoSegments);
    setSegmentHistory({ past: newPast, future: newFuture });
  };

  const redo = () => {
    if (segmentHistory.future.length === 0) return;
    const next = segmentHistory.future[0];
    const newFuture = segmentHistory.future.slice(1);
    const newPast = [...segmentHistory.past, { segments: editableSegments, rippleDeletes, videoSegments }];
    
    setEditableSegments(next.segments);
    setRippleDeletes(next.rippleDeletes);
    setVideoSegments(next.videoSegments);
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
    updateVideoSegments((prev) => {
      const newSegments = [...prev];
      const targetIndex = newSegments.findIndex(s => time > s.timelineStart && time < s.timelineEnd);
      if (targetIndex !== -1) {
        const target = newSegments[targetIndex];
        const timelineRatio = (time - target.timelineStart) / (target.timelineEnd - target.timelineStart);
        const sourceTime = target.sourceStart + timelineRatio * (target.sourceEnd - target.sourceStart);
        
        const firstHalf: VideoSegment = { ...target, timelineEnd: time, sourceEnd: sourceTime };
        const secondHalf: VideoSegment = { ...target, id: Math.random().toString(36).substr(2, 9), timelineStart: time, sourceStart: sourceTime };
        newSegments.splice(targetIndex, 1, firstHalf, secondHalf);
      }
      return newSegments;
    });
  };

  const handleVideoDelete = (ids: string[]) => {
    updateVideoSegments((prev) => {
      return prev.map(s => ids.includes(s.id) ? { ...s, deleted: true } : s);
    });
  };

  const handleVideoRippleDelete = (ids: string[]) => {
    const regionsToAdd: { start: number; end: number }[] = [];
    updateVideoSegments((prev) => {
      return prev.map(s => {
        if (ids.includes(s.id)) {
          regionsToAdd.push({ start: s.timelineStart, end: s.timelineEnd });
          return { ...s, deleted: true };
        }
        return s;
      });
    });
    if (regionsToAdd.length > 0) {
      setRippleDeletes((prev) => [...prev, ...regionsToAdd]);
    }
  };

  const handleClearTrack = (trackType: 'subtitle' | 'video') => {
    if (trackType === 'subtitle') {
      updateSegments([]);
    } else {
      updateVideoSegments([]);
    }
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
    handleVideoCut,
    handleVideoDelete,
    handleVideoRippleDelete,
    handleClearTrack,
  };
}

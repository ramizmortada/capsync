import { useState } from "react";
import { resegmentTranscripts } from "@/lib/chunking";
import { set as idbSet } from "idb-keyval";

type HistoryState = { segments: any[]; rippleDeletes: { start: number; end: number }[] };

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
  const [rippleDeletes, setRippleDeletes] = useState<{ start: number; end: number }[]>([]);
  const [segmentHistory, setSegmentHistory] = useState<{ past: HistoryState[]; future: HistoryState[] }>({
    past: [],
    future: [],
  });

  const updateSegments = (newSegments: any[] | ((prev: any[]) => any[])) => {
    setEditableSegments((prevSegments) => {
      const updated = typeof newSegments === "function" ? newSegments(prevSegments) : newSegments;
      setSegmentHistory((prevHistory) => ({
        past: [...prevHistory.past, { segments: prevSegments, rippleDeletes: [...rippleDeletes] }].slice(-50),
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
      newSegments[index] = { ...newSegments[index], text: newText };
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
      return prev.map((seg) => {
        if (!seg.words) return seg;
        const updatedWords = seg.words.map((word: any) => {
          if (word.isGap && word.end - word.start >= silenceThreshold) {
            return { ...word, deleted: true };
          }
          return word;
        });
        return { ...seg, words: updatedWords };
      });
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
          // Note: we can toggle it deleted immediately
          updateSegments((prev) => {
            const newSegments = [...prev];
            const segment = { ...newSegments[sIdx] };
            if (segment.words) {
              const words = [...segment.words];
              words[wIdx] = { ...words[wIdx], deleted: true };
              segment.words = words;
            }
            newSegments[sIdx] = segment;
            return newSegments;
          });
        }
      }
    });
    setRippleDeletes((prev) => [...prev, ...regionsToAdd]);
    if (segmentIndicesToDelete.length > 0) {
      handleDeleteSegments(segmentIndicesToDelete);
    }
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

  return {
    editableSegments,
    setEditableSegments,
    selectedIndexes,
    setSelectedIndexes,
    rippleDeletes,
    setRippleDeletes,
    segmentHistory,
    setSegmentHistory,
    updateSegments,
    handleResegment,
    handleSegmentChange,
    handleToggleWordDelete,
    handleToggleSegmentSilence,
    handleAutoCutSilences,
    handleMergeSegments,
    handleDeleteSegments,
    handleLiftDelete,
    handleRippleDelete,
    handleDuplicateSegment,
    handleOffsetSegments,
  };
}

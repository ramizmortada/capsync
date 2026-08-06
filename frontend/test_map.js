const videoSegments = [
  { sourceStart: 0, sourceEnd: 10, timelineStart: 0, timelineEnd: 10, deleted: true },
  { sourceStart: 10, sourceEnd: 120, timelineStart: 0, timelineEnd: 110, deleted: false }
];

const rawSegments = [
  { start: 0, end: 5, text: "Hello", words: [{start: 0, end: 5, word: "Hello"}] },
  { start: 15, end: 20, text: "World", words: [{start: 15, end: 20, word: "World"}] }
];

const activeSegs = (videoSegments || []).filter((s) => !s.deleted);

const mapTimeToTimeline = (sourceTime) => {
  const seg = activeSegs.find(
    (s) => sourceTime >= s.sourceStart - 0.05 && sourceTime <= s.sourceEnd + 0.05
  );
  if (!seg) return null;
  return seg.timelineStart + Math.max(0, Math.min(seg.timelineEnd - seg.timelineStart, sourceTime - seg.sourceStart));
};

const processedSegments = [];
for (const seg of rawSegments) {
  let mappedWords = [];
  if (seg.words && seg.words.length > 0) {
    mappedWords = seg.words
      .map((w) => {
        const wStart = mapTimeToTimeline(w.start);
        const wEnd = mapTimeToTimeline(w.end);
        if (wStart === null || wEnd === null) return null;
        return {
          ...w,
          start: wStart,
          end: wEnd,
          word: w.word || w.text
        };
      })
      .filter(Boolean);
    if (mappedWords.length === 0) continue;
  }
  
  const mappedStart = mapTimeToTimeline(seg.start);
  const mappedEnd = mapTimeToTimeline(seg.end);

  if (mappedStart === null && mappedEnd === null && mappedWords.length === 0) continue;

  const firstWord = mappedWords[0];
  const lastWord = mappedWords[mappedWords.length - 1];

  const finalStart = firstWord ? firstWord.start : (mappedStart ?? 0);
  const finalEnd = lastWord ? lastWord.end : (mappedEnd ?? finalStart + 1);

  const segmentText = mappedWords.length > 0
    ? mappedWords.map((w) => w.word || w.text).join(" ")
    : seg.text;

  processedSegments.push({
    ...seg,
    start: finalStart,
    end: finalEnd,
    text: segmentText,
    words: mappedWords
  });
}

console.log(JSON.stringify(processedSegments, null, 2));

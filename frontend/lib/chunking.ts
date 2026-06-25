export function resegmentTranscripts(rawSegments: any[], maxWordsStr: string): any[] {
  const maxWords = parseInt(maxWordsStr, 10);
  
  // If maxWords is 0 (Default), we just use the raw segments as they are
  let finalSegments = rawSegments;

  if (maxWords !== 0) {
    const chunkedSegments: any[] = [];

    for (const segment of rawSegments) {
      const words = segment.words || [];
      if (words.length === 0) {
        chunkedSegments.push(segment);
        continue;
      }

      if (maxWords < 0) {
        // Smart Mode: Dynamic Pauses
        const softLimit = maxWords === -1 ? 6 : 3;
        let chunk: any[] = [];

        for (let i = 0; i < words.length; i++) {
          const w = words[i];
          chunk.push(w);

          const wordText = w.word || "";
          const hasPunctuation = [".", ",", "!", "?", ";", ":"].some((p) => wordText.includes(p));

          let pauseAfter = 0;
          if (i < words.length - 1 && "end" in w && "start" in words[i + 1]) {
            pauseAfter = words[i + 1].start - w.end;
          }

          const isTooLong = chunk.length >= softLimit;

          if (hasPunctuation || pauseAfter > 0.3 || isTooLong || i === words.length - 1) {
            const validWords = chunk.filter((cw) => "start" in cw && "end" in cw);
            if (validWords.length > 0) {
              const text = chunk.map((cw) => cw.word).join(" ");
              chunkedSegments.push({
                start: validWords[0].start,
                end: validWords[validWords.length - 1].end,
                text: text,
                words: [...chunk],
              });
            }
            chunk = [];
          }
        }
      } else {
        // Strict chunking
        for (let i = 0; i < words.length; i += maxWords) {
          const chunk = words.slice(i, i + maxWords);
          const validWords = chunk.filter((w: any) => "start" in w && "end" in w);
          if (validWords.length === 0) continue;

          const text = chunk.map((w: any) => w.word).join(" ");
          chunkedSegments.push({
            start: validWords[0].start,
            end: validWords[validWords.length - 1].end,
            text: text,
            words: chunk,
          });
        }
      }
    }
    finalSegments = chunkedSegments;
  } else {
    // We must deep copy to avoid modifying the raw segments
    finalSegments = JSON.parse(JSON.stringify(rawSegments));
  }

  // Extend timestamps to eliminate gaps between segments
  if (finalSegments.length > 0) {
    for (let i = 0; i < finalSegments.length - 1; i++) {
      if (finalSegments[i].end < finalSegments[i + 1].start) {
        finalSegments[i].end = finalSegments[i + 1].start;
      }
    }
  }

  return finalSegments;
}

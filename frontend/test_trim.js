const trimSubtitlesByRegions = (segments, regions) => {
  if (!regions || regions.length === 0) return segments;

  let result = [...segments];

  for (const region of regions) {
    const trimmed = [];

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
      if (seg.start < region.start - EPSILON && seg.end > region.end + EPSILON) {
        const leftPart = { ...seg };
        leftPart.end = region.start;
        if (leftPart.end - leftPart.start > EPSILON) {
          trimmed.push(leftPart);
        }

        const rightPart = { ...seg };
        rightPart.start = region.end;
        if (rightPart.end - rightPart.start > EPSILON) {
          trimmed.push(rightPart);
        }
        continue;
      }

      // Partial overlap — tail extends into region (seg.start < region.start, seg.end inside region)
      if (seg.start < region.start - EPSILON) {
        const trimmedSeg = { ...seg, end: region.start };
        if (trimmedSeg.end - trimmedSeg.start > EPSILON) {
          trimmed.push(trimmedSeg);
        }
        continue;
      }

      // Partial overlap — head starts inside region (seg.start inside region, seg.end > region.end)
      if (seg.end > region.end + EPSILON) {
        const trimmedSeg = { ...seg, start: region.end };
        if (trimmedSeg.end - trimmedSeg.start > EPSILON) {
          trimmed.push(trimmedSeg);
        }
        continue;
      }
    }
    result = trimmed;
  }
  return result;
};

const segments = [
  { start: 0.1, end: 1.0, text: "So," },
  { start: 1.1, end: 2.0, text: "no matter what I say" },
  { start: 5.9, end: 7.0, text: "Wait" },
];

const regions = [{ start: 0, end: 6 }];

console.log(trimSubtitlesByRegions(segments, regions));

import { useMemo } from 'react';

export function useCutZones(
  editableSegments: any[],
  rippleDeletes: any[],
  videoSegments: any[],
  safePadding: number
) {
  return useMemo(() => {
    let rawIntervals: { start: number; end: number; isSegmentStart: boolean; isSegmentEnd: boolean }[] = [];
    
    editableSegments.forEach((seg) => {
      if (!seg.words || seg.words.length === 0) return;
      
      const realWords = seg.words.filter((w: any) => !w.isGap);
      const isFullyDeleted = realWords.length > 0 && realWords.every((w: any) => w.deleted);
      
      if (isFullyDeleted) {
        rawIntervals.push({
          start: seg.start,
          end: seg.end,
          isSegmentStart: true,
          isSegmentEnd: true
        });
      } else {
        seg.words.forEach((w: any) => {
          if (w.deleted) {
            rawIntervals.push({
              start: w.start,
              end: w.end,
              isSegmentStart: false,
              isSegmentEnd: false
            });
          }
        });
      }
    });

    rippleDeletes.forEach(zone => {
      rawIntervals.push({
        start: zone.start,
        end: zone.end,
        isSegmentStart: true,
        isSegmentEnd: true
      });
    });

    videoSegments.forEach(seg => {
      if (seg.deleted) {
        rawIntervals.push({
          start: seg.timelineStart,
          end: seg.timelineEnd,
          isSegmentStart: true,
          isSegmentEnd: true
        });
      }
    });

    if (rawIntervals.length === 0) return [];

    rawIntervals.sort((a, b) => a.start - b.start);

    let merged: typeof rawIntervals = [];
    let current = { ...rawIntervals[0] };

    for (let i = 1; i < rawIntervals.length; i++) {
      const next = rawIntervals[i];
      if (next.start <= current.end + 0.05) {
        current.end = Math.max(current.end, next.end);
        current.isSegmentEnd = current.isSegmentEnd || next.isSegmentEnd;
        current.isSegmentStart = current.isSegmentStart || next.isSegmentStart;
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);

    const pad = safePadding / 1000;
    const finalZones: { start: number; end: number }[] = [];

    merged.forEach((zone) => {
      const cutStart = zone.isSegmentStart ? zone.start : zone.start + pad;
      const cutEnd = zone.isSegmentEnd ? zone.end : zone.end - pad;

      if (cutEnd - cutStart > 0.02) {
        finalZones.push({ start: cutStart, end: cutEnd });
      }
    });

    return finalZones;
  }, [editableSegments, safePadding, rippleDeletes, videoSegments]);
}

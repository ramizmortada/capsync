import { useEffect, useRef } from 'react';

interface UsePlaybackSyncProps {
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  trackRef: React.RefObject<HTMLDivElement | null>;
  mediaDuration: number;
  videoSegments: any[];
  rippleDeletes: any[];
  editableSegments: any[];
  masterTimeRef: React.MutableRefObject<number>;
  setMasterTime: React.Dispatch<React.SetStateAction<number>>;
  masterTime: number;
  isPlayingRef: React.MutableRefObject<boolean>;
  isHoveringTimeline: React.MutableRefObject<boolean>;
  draggingBoundary: any;
  zoomLevel: number;
}

export function usePlaybackSync({
  mediaRef,
  timelineRef,
  trackRef,
  mediaDuration,
  videoSegments,
  rippleDeletes,
  editableSegments,
  masterTimeRef,
  setMasterTime,
  masterTime,
  isPlayingRef,
  isHoveringTimeline,
  draggingBoundary,
  zoomLevel
}: UsePlaybackSyncProps) {
  const lastRealTimeRef = useRef(0);
  const playRequestedRef = useRef(false);
  const playbackSkipZonesRef = useRef<{start: number, end: number}[]>([]);

  // Calculate skip zones in source time
  useEffect(() => {
    const zones: {start: number, end: number}[] = [];
    rippleDeletes.forEach(z => zones.push({ ...z }));
    videoSegments.forEach(s => {
      // s.deleted implies the video segment is deleted in source time
      if (s.deleted) zones.push({ start: s.sourceStart, end: s.sourceEnd });
    });
    zones.sort((a, b) => a.start - b.start);
    const merged: {start: number, end: number}[] = [];
    for (const z of zones) {
      if (merged.length > 0 && z.start <= merged[merged.length - 1].end + 0.01) {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, z.end);
      } else {
        merged.push({ ...z });
      }
    }
    playbackSkipZonesRef.current = merged;
  }, [rippleDeletes, videoSegments]);

  // Center timeline on playhead initially
  useEffect(() => {
    if (timelineRef.current && trackRef.current && mediaRef.current && mediaDuration > 0) {
      const trackWidth = trackRef.current.scrollWidth;
      const playheadX = (mediaRef.current.currentTime / mediaDuration) * trackWidth;
      const container = timelineRef.current;
      container.scrollLeft = playheadX - container.clientWidth / 2;
    }
  }, [zoomLevel, mediaDuration, timelineRef, trackRef, mediaRef]);

  // Smooth Sync Loop
  useEffect(() => {
    let animationFrameId: number;

    const smoothSync = (timestamp: number) => {
      if (!mediaRef.current || mediaDuration <= 0) {
        animationFrameId = requestAnimationFrame(smoothSync);
        return;
      }
      
      if (isPlayingRef.current) {
        let newTime = mediaRef.current.currentTime;
        
        // Skip over cut zones instantly
        const activeSkipZone = playbackSkipZonesRef.current.find(z => newTime >= z.start && newTime < z.end);
        if (activeSkipZone) {
          newTime = activeSkipZone.end;
          mediaRef.current.currentTime = newTime;
        }

        // Check if we reached the end of the playable media
        if (newTime >= mediaDuration) {
          if (!mediaRef.current.paused) {
            mediaRef.current.pause();
          }
          playRequestedRef.current = false;
          isPlayingRef.current = false;
        }
        
        // Always sync master time to current time
        masterTimeRef.current = newTime;
        setMasterTime(newTime);
      }

      // Update scroll position based on mapped timeline time
      // Since toTimelineTime isn't passed down, we approximate scrolling via source percentage.
      // The timeline visual layout handles exact positioning via playheadX.
      if (timelineRef.current && trackRef.current && !isHoveringTimeline.current && draggingBoundary === null) {
        const trackWidth = trackRef.current.scrollWidth;
        const timelineDur = Math.max(mediaDuration, 0.1); // Fallback approximation for scroll proportion
        const playheadX = (masterTimeRef.current / timelineDur) * trackWidth;
        const container = timelineRef.current;
        const clientWidth = container.clientWidth;
        container.scrollLeft = playheadX - clientWidth / 2;
      }

      animationFrameId = requestAnimationFrame(smoothSync);
    };

    animationFrameId = requestAnimationFrame(smoothSync);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [mediaDuration, draggingBoundary, isPlayingRef, isHoveringTimeline, masterTimeRef, mediaRef, setMasterTime, timelineRef, trackRef]);

  // Auto-scroll subtitle editor list
  useEffect(() => {
    if (!mediaRef.current || mediaRef.current.paused || mediaDuration <= 0) return;

    const activeIndex = editableSegments.findIndex((s: any) => masterTime >= s.start && masterTime < s.end);
    if (activeIndex !== -1) {
      const activeElement = document.getElementById(`subtitle-segment-${activeIndex}`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [masterTime, mediaDuration, editableSegments, mediaRef]);

  const getValidSeekTime = (time: number) => {
    const activeSkipZone = playbackSkipZonesRef.current.find(z => time >= z.start && time < z.end);
    if (activeSkipZone) {
      return activeSkipZone.end;
    }
    return time;
  };

  return { getValidSeekTime };
}

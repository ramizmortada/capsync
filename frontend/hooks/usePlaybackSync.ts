import { useEffect, useRef, useState, useCallback } from 'react';

interface UsePlaybackSyncProps {
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  trackRef: React.RefObject<HTMLDivElement | null>;
  mediaDuration: number;
  videoSegments: any[];
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

  const timelineMapRef = useRef<any[]>([]);

  useEffect(() => {
    let map = [...videoSegments].filter(s => !s.deleted).sort((a, b) => a.timelineStart - b.timelineStart);
    if (map.length === 0 && mediaDuration > 0) {
      map = [{
        timelineStart: 0,
        timelineEnd: mediaDuration,
        sourceStart: 0,
        sourceEnd: mediaDuration,
      }];
    }
    timelineMapRef.current = map;
  }, [videoSegments, mediaDuration]);

  // Initial centering
  useEffect(() => {
    if (timelineRef.current && trackRef.current && mediaRef.current && mediaDuration > 0) {
      const trackWidth = trackRef.current.scrollWidth;
      const timelineDur = Math.max(mediaDuration, 0.1);
      const playheadX = (masterTimeRef.current / timelineDur) * trackWidth;
      const container = timelineRef.current;
      container.scrollLeft = playheadX - container.clientWidth / 2;
    }
  }, [mediaDuration, timelineRef, trackRef, mediaRef]);

  // Ensure media currentTime is aligned on initial load or segment changes when paused
  useEffect(() => {
    if (mediaRef.current && !isPlayingRef.current && timelineMapRef.current.length > 0) {
      const activeSeg = timelineMapRef.current.find(s => masterTime >= s.timelineStart && masterTime < s.timelineEnd) || timelineMapRef.current[0];
      if (activeSeg) {
        const expectedSourceTime = activeSeg.sourceStart + Math.max(0, masterTime - activeSeg.timelineStart);
        if (Math.abs(mediaRef.current.currentTime - expectedSourceTime) > 0.05) {
          mediaRef.current.currentTime = expectedSourceTime;
        }
      }
    }
  }, [videoSegments, mediaDuration, mediaRef, masterTime, isPlayingRef]);

  const [currentSourceTime, setCurrentSourceTime] = useState(0);

  useEffect(() => {
    let animationFrameId: number;

    const smoothSync = (timestamp: number) => {
      if (!mediaRef.current || mediaDuration <= 0) {
        animationFrameId = requestAnimationFrame(smoothSync);
        return;
      }
      
      setCurrentSourceTime(mediaRef.current.currentTime);
      
      if (isPlayingRef.current) {
        if (mediaRef.current.seeking) {
          animationFrameId = requestAnimationFrame(smoothSync);
          return;
        }

        let currentMaster = masterTimeRef.current;
        const timelineMap = timelineMapRef.current;
        const mediaTime = mediaRef.current.currentTime;

        const activeSegment = timelineMap.find(s => 
          currentMaster >= s.timelineStart && currentMaster < s.timelineEnd
        ) || timelineMap.find(s => 
          mediaTime >= s.sourceStart - 0.01 && mediaTime < s.sourceEnd
        );

        if (activeSegment) {
          const expectedSourceTime = activeSegment.sourceStart + Math.max(0, currentMaster - activeSegment.timelineStart);

          // If media hardware clock is out of sync with current master timeline position (e.g. initial load after refresh), seek media hardware clock to expected source position!
          if (Math.abs(mediaTime - expectedSourceTime) > 0.15) {
            mediaRef.current.currentTime = expectedSourceTime;
            animationFrameId = requestAnimationFrame(smoothSync);
            return;
          }

          // Derive master timeline position directly from video element hardware clock
          currentMaster = activeSegment.timelineStart + Math.max(0, mediaTime - activeSegment.sourceStart);

          // Only jump media position when crossing segment boundaries
          if (mediaTime >= activeSegment.sourceEnd - 0.02 || currentMaster >= activeSegment.timelineEnd - 0.02) {
             const nextSegment = timelineMap.find(s => s.timelineStart >= activeSegment.timelineEnd);
             if (nextSegment) {
               currentMaster = nextSegment.timelineStart + 0.01;
               mediaRef.current.currentTime = nextSegment.sourceStart + 0.01;
             } else {
               mediaRef.current.pause();
               isPlayingRef.current = false;
               const firstSeg = timelineMap[0];
               currentMaster = 0;
               mediaRef.current.currentTime = firstSeg ? firstSeg.sourceStart : 0;
               if (timelineRef.current) {
                 timelineRef.current.scrollLeft = 0;
               }
             }
          }
        } else {
          const nextSegment = timelineMap.find(s => s.timelineStart > currentMaster);
          if (nextSegment) {
            currentMaster = nextSegment.timelineStart + 0.01;
            mediaRef.current.currentTime = nextSegment.sourceStart + 0.01;
          } else {
             mediaRef.current.pause();
             isPlayingRef.current = false;
             const firstSeg = timelineMap[0];
             currentMaster = 0;
             mediaRef.current.currentTime = firstSeg ? firstSeg.sourceStart : 0;
             if (timelineRef.current) {
               timelineRef.current.scrollLeft = 0;
             }
          }
        }

        masterTimeRef.current = currentMaster;
        setMasterTime(currentMaster);
      }

      if (isPlayingRef.current && timelineRef.current && trackRef.current && !isHoveringTimeline.current && draggingBoundary === null) {
        const trackWidth = trackRef.current.scrollWidth;
        const maxTimelineEnd = timelineMapRef.current.length > 0
          ? timelineMapRef.current.reduce((max, s) => Math.max(max, s.timelineEnd), 0)
          : (mediaDuration > 0 ? mediaDuration : 0.1);
        const timelineDur = Math.max(maxTimelineEnd, 0.1);
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

  const handleTimelineSeek = useCallback((time: number) => {
    let validTime = time;

    masterTimeRef.current = validTime;
    setMasterTime(validTime);

    const timelineMap = timelineMapRef.current;
    const activeSeg = timelineMap.find(s => validTime >= s.timelineStart && validTime < s.timelineEnd);
    
    if (activeSeg && mediaRef.current) {
      mediaRef.current.currentTime = activeSeg.sourceStart + (validTime - activeSeg.timelineStart);
      setCurrentSourceTime(mediaRef.current.currentTime);
    }
  }, [masterTimeRef, setMasterTime, mediaRef]);

  return { handleTimelineSeek, currentSourceTime };
}

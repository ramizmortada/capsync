import { useEffect, useRef, useState } from 'react';

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
        
        const activeSegment = timelineMap.find(s => 
          currentMaster >= s.timelineStart && currentMaster < s.timelineEnd
        );

        if (activeSegment) {
          const expectedSourceTime = activeSegment.sourceStart + (currentMaster - activeSegment.timelineStart);
          
          if (Math.abs(mediaRef.current.currentTime - expectedSourceTime) > 0.15) {
            mediaRef.current.currentTime = expectedSourceTime;
          } else {
            currentMaster = activeSegment.timelineStart + (mediaRef.current.currentTime - activeSegment.sourceStart);
          }

          if (currentMaster >= activeSegment.timelineEnd - 0.01 || mediaRef.current.currentTime >= activeSegment.sourceEnd - 0.01) {
             const nextSegment = timelineMap.find(s => s.timelineStart >= activeSegment.timelineEnd);
             if (nextSegment) {
               currentMaster = nextSegment.timelineStart + 0.01;
               mediaRef.current.currentTime = nextSegment.sourceStart + 0.01;
             } else {
               mediaRef.current.pause();
               isPlayingRef.current = false;
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

    const activeIndex = editableSegments.findIndex((s: any) => currentSourceTime >= s.start && currentSourceTime < s.end);
    if (activeIndex !== -1) {
      const activeElement = document.getElementById(`subtitle-segment-${activeIndex}`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentSourceTime, mediaDuration, editableSegments, mediaRef]);

  const handleTimelineSeek = (time: number) => {
    let validTime = time;

    masterTimeRef.current = validTime;
    setMasterTime(validTime);

    const timelineMap = timelineMapRef.current;
    const activeSeg = timelineMap.find(s => validTime >= s.timelineStart && validTime < s.timelineEnd);
    
    if (activeSeg && mediaRef.current) {
      mediaRef.current.currentTime = activeSeg.sourceStart + (validTime - activeSeg.timelineStart);
      setCurrentSourceTime(mediaRef.current.currentTime);
    }
  };

  return { handleTimelineSeek, currentSourceTime };
}

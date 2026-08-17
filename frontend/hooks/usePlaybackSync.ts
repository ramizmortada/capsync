import { useEffect, useRef, useState, useCallback } from 'react';

interface UsePlaybackSyncProps {
  mediaRef: React.RefObject<HTMLMediaElement | null>;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  trackRef: React.RefObject<HTMLDivElement | null>;
  mediaDuration: number;
  videoSegments: any[];
  audioSegments?: any[];
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
  audioRef,
  timelineRef,
  trackRef,
  mediaDuration,
  videoSegments,
  audioSegments,
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
    const activeAudio = (audioSegments && audioSegments.length > 0) 
      ? audioSegments.filter(s => !s.deleted)
      : videoSegments.filter(s => !s.deleted);
    let map = [...activeAudio].sort((a, b) => a.timelineStart - b.timelineStart);
    if (map.length === 0 && mediaDuration > 0) {
      map = [{
        timelineStart: 0,
        timelineEnd: mediaDuration,
        sourceStart: 0,
        sourceEnd: mediaDuration,
      }];
    }
    timelineMapRef.current = map;
  }, [videoSegments, audioSegments, mediaDuration]);

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
    if (mediaRef.current && !isPlayingRef.current) {
      const activeVideo = (videoSegments || []).find(s => !s.deleted && masterTime >= s.timelineStart && masterTime < s.timelineEnd);
      const activeAudio = (audioSegments || []).find(s => !s.deleted && masterTime >= s.timelineStart && masterTime < s.timelineEnd);
      const targetSeg = activeVideo || activeAudio;
      if (targetSeg) {
        const expectedSourceTime = targetSeg.sourceStart + Math.max(0, masterTime - targetSeg.timelineStart);
        if (Math.abs(mediaRef.current.currentTime - expectedSourceTime) > 0.03) {
          mediaRef.current.currentTime = Math.max(0, Math.min(mediaDuration, expectedSourceTime));
          setCurrentSourceTime(expectedSourceTime);
        }
      }
      if (activeAudio && audioRef?.current) {
        const expectedAudioTime = activeAudio.sourceStart + Math.max(0, masterTime - activeAudio.timelineStart);
        if (Math.abs(audioRef.current.currentTime - expectedAudioTime) > 0.03) {
          audioRef.current.currentTime = Math.max(0, Math.min(mediaDuration, expectedAudioTime));
        }
      }
    }
  }, [videoSegments, audioSegments, mediaDuration, mediaRef, audioRef, masterTime, isPlayingRef]);

  const [currentSourceTime, setCurrentSourceTime] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const smoothSync = (timestamp: number) => {
      if (!mediaRef.current || mediaDuration <= 0) {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(smoothSync);
        return;
      }
      
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (isPlayingRef.current) {
        let currentMaster = masterTimeRef.current + dt;

        const maxActiveVideoEnd = videoSegments.reduce((max, s) => s.deleted ? max : Math.max(max, s.timelineEnd), 0);
        const maxActiveAudioEnd = (audioSegments || []).reduce((max, s) => s.deleted ? max : Math.max(max, s.timelineEnd), 0);
        const timelineMax = Math.max(maxActiveVideoEnd, maxActiveAudioEnd, 0.1);

        if (currentMaster >= timelineMax) {
          mediaRef.current.pause();
          if (audioRef?.current) audioRef.current.pause();
          isPlayingRef.current = false;
          currentMaster = 0;
          masterTimeRef.current = 0;
          setMasterTime(0);
          handleTimelineSeek(0);
          animationFrameId = requestAnimationFrame(smoothSync);
          return;
        }

        const activeVideo = (videoSegments || []).find(s => !s.deleted && currentMaster >= s.timelineStart && currentMaster < s.timelineEnd);
        const activeAudio = (audioSegments || []).find(s => !s.deleted && currentMaster >= s.timelineStart && currentMaster < s.timelineEnd);

        const videoSrcTime = activeVideo ? activeVideo.sourceStart + (currentMaster - activeVideo.timelineStart) : null;
        const audioSrcTime = activeAudio ? activeAudio.sourceStart + (currentMaster - activeAudio.timelineStart) : null;

        // 1. Audio track playback (Dedicated Primary Audio Engine)
        if (audioRef?.current) {
          if (activeAudio && audioSrcTime !== null) {
            if (Math.abs(audioRef.current.currentTime - audioSrcTime) > 0.12) {
              audioRef.current.currentTime = Math.max(0, Math.min(mediaDuration, audioSrcTime));
            }
            if (audioRef.current.paused) {
              audioRef.current.play().catch(() => {});
            }
          } else {
            if (!audioRef.current.paused) {
              audioRef.current.pause();
            }
          }
        }

        // 2. Video track visual playback (Silent Frame Renderer)
        if (mediaRef.current) {
          if (audioRef?.current) {
            mediaRef.current.muted = true;
          }
          if (activeVideo && videoSrcTime !== null) {
            if (Math.abs(mediaRef.current.currentTime - videoSrcTime) > 0.12) {
              mediaRef.current.currentTime = Math.max(0, Math.min(mediaDuration, videoSrcTime));
            }
            if (mediaRef.current.paused) {
              mediaRef.current.play().catch(() => {});
            }
          } else {
            if (!mediaRef.current.paused) {
              mediaRef.current.pause();
            }
          }
        }

        masterTimeRef.current = currentMaster;
        setMasterTime(currentMaster);
        setCurrentSourceTime(videoSrcTime ?? audioSrcTime ?? currentMaster);
      } else {
        lastTime = performance.now();
        if (audioRef?.current && !audioRef.current.paused) {
          audioRef.current.pause();
        }
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
  }, [mediaDuration, draggingBoundary, isPlayingRef, isHoveringTimeline, masterTimeRef, mediaRef, audioRef, setMasterTime, timelineRef, trackRef, videoSegments, audioSegments]);

  const handleTimelineSeek = useCallback((time: number) => {
    let validTime = time;

    masterTimeRef.current = validTime;
    setMasterTime(validTime);

    const activeVideo = (videoSegments || []).find(s => !s.deleted && validTime >= s.timelineStart && validTime < s.timelineEnd);
    const activeAudio = (audioSegments || []).find(s => !s.deleted && validTime >= s.timelineStart && validTime < s.timelineEnd);
    
    if (activeVideo && mediaRef.current) {
      const vTarget = activeVideo.sourceStart + (validTime - activeVideo.timelineStart);
      mediaRef.current.currentTime = Math.max(0, Math.min(mediaDuration, vTarget));
      setCurrentSourceTime(mediaRef.current.currentTime);
    } else if (activeAudio && mediaRef.current) {
      const aTarget = activeAudio.sourceStart + (validTime - activeAudio.timelineStart);
      mediaRef.current.currentTime = Math.max(0, Math.min(mediaDuration, aTarget));
      setCurrentSourceTime(mediaRef.current.currentTime);
    }

    if (activeAudio && audioRef?.current) {
      const aTarget = activeAudio.sourceStart + (validTime - activeAudio.timelineStart);
      audioRef.current.currentTime = Math.max(0, Math.min(mediaDuration, aTarget));
    }
  }, [masterTimeRef, setMasterTime, mediaRef, audioRef, videoSegments, audioSegments, mediaDuration]);

  return { handleTimelineSeek, currentSourceTime };
}

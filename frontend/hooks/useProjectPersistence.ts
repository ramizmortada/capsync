import { useState, useEffect } from 'react';
import { getTimeline, saveTimeline, getAllTimelines } from '@/lib/timelineStorage';

interface UseProjectPersistenceProps {
  timelineId?: string | null;
  timelineName?: string;
  setTimelineName?: (name: string) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  status: any;
  setStatus: (status: any) => void;
  result: any;
  setResult: (result: any) => void;
  editableSegments: any[];
  setEditableSegments: (segments: any[]) => void;
  rippleDeletes: any[];
  setRippleDeletes: (deletes: any[]) => void;
  videoSegments: any[];
  setVideoSegments: (segments: any[]) => void;
  videoCanvas: any;
  setVideoCanvas: (canvas: any) => void;
  subtitleStyle: any;
  setSubtitleStyle: (style: any) => void;
  setModelSize: (size: string) => void;
  setLanguage: (lang: string) => void;
  setMaxWords: (words: string) => void;
  mediaRef: React.RefObject<HTMLMediaElement | null>;
}

export function useProjectPersistence({
  timelineId,
  timelineName,
  setTimelineName,
  file,
  setFile,
  status,
  setStatus,
  result,
  setResult,
  editableSegments,
  setEditableSegments,
  rippleDeletes,
  setRippleDeletes,
  videoSegments,
  setVideoSegments,
  videoCanvas,
  setVideoCanvas,
  subtitleStyle,
  setSubtitleStyle,
  setModelSize,
  setLanguage,
  setMaxWords,
  mediaRef
}: UseProjectPersistenceProps) {
  const [activeId, setActiveId] = useState<string>(timelineId || 'main_timeline');
  const [isProjectLoaded, setIsProjectLoaded] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);

  // Load timeline from IndexedDB
  useEffect(() => {
    async function loadProject() {
      try {
        let currentId = timelineId;
        if (!currentId) {
          const timelines = await getAllTimelines();
          if (timelines.length > 0) {
            currentId = timelines[0].id;
          } else {
            currentId = 'main_timeline';
          }
        }

        setActiveId(currentId);

        if (currentId) {
          const savedProject = await getTimeline(currentId);
          if (savedProject) {
            if (savedProject.name && setTimelineName) setTimelineName(savedProject.name);
            if (savedProject.file) setFile(savedProject.file);
            if (savedProject.status) setStatus(savedProject.status);
            if (savedProject.result) setResult(savedProject.result);
            if (savedProject.editableSegments) setEditableSegments(savedProject.editableSegments);
            if (savedProject.rippleDeletes) setRippleDeletes(savedProject.rippleDeletes);
            if (savedProject.videoSegments) setVideoSegments(savedProject.videoSegments);
            if (savedProject.videoCanvas) setVideoCanvas(savedProject.videoCanvas);
          }
        }
      } catch (err) {
        console.error("Failed to load project from IDB", err);
      } finally {
        setIsProjectLoaded(true);
      }
    }
    loadProject();
  }, [timelineId, setTimelineName, setFile, setStatus, setResult, setEditableSegments, setRippleDeletes, setVideoSegments, setVideoCanvas]);

  // Load subtitle style from localStorage
  useEffect(() => {
    const savedStyle = localStorage.getItem("capsync_subtitle_style");
    if (savedStyle) {
      try {
        const parsed = JSON.parse(savedStyle);
        setSubtitleStyle((prev: any) => ({ ...prev, ...parsed }));
      } catch (err) {
        console.error("Failed to load subtitle style from localStorage", err);
      }
    }
    setIsStyleLoaded(true);
  }, [setSubtitleStyle]);

  // Load from capsync_pending_clip
  useEffect(() => {
    const pendingClip = localStorage.getItem('capsync_pending_clip');
    if (pendingClip) {
      try {
        const { rippleDeletes: pendingRippleDeletes, seekTime } = JSON.parse(pendingClip);
        setRippleDeletes(pendingRippleDeletes);
        
        // Seek to the clip start
        if (mediaRef.current && seekTime !== undefined) {
           setTimeout(() => {
             if (mediaRef.current) mediaRef.current.currentTime = seekTime;
           }, 500);
        }
      } catch (e) {
        console.error('Failed to load pending clip', e);
      }
      localStorage.removeItem('capsync_pending_clip');
    }
  }, [setRippleDeletes, mediaRef]);

  // Save project to IndexedDB
  useEffect(() => {
    if (isProjectLoaded && activeId) {
      saveTimeline({
        id: activeId,
        name: timelineName || 'Timeline',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        file,
        status,
        result,
        editableSegments,
        rippleDeletes,
        videoSegments,
        videoCanvas,
        subtitleStyle,
      }).catch(console.error);
    }
  }, [isProjectLoaded, activeId, timelineName, file, status, result, editableSegments, rippleDeletes, videoSegments, videoCanvas, subtitleStyle]);

  // Save subtitle style to localStorage
  useEffect(() => {
    if (isStyleLoaded) {
      localStorage.setItem("capsync_subtitle_style", JSON.stringify(subtitleStyle));
    }
  }, [isStyleLoaded, subtitleStyle]);

  // Load settings from local storage
  useEffect(() => {
    const savedModel = localStorage.getItem("whisperx_model");
    const savedLang = localStorage.getItem("whisperx_lang");
    const savedWords = localStorage.getItem("whisperx_words");
    
    if (savedModel) setModelSize(savedModel);
    if (savedLang !== null) setLanguage(savedLang);
    if (savedWords) setMaxWords(savedWords);
  }, [setModelSize, setLanguage, setMaxWords]);
}

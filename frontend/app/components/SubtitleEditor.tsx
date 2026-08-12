import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { TimelineContextMenu, ContextMenuData } from "./timeline/TimelineContextMenu";
import { set } from 'idb-keyval';
import { createScreencapProject } from "@/lib/screencapStorage";
import { SubtitleHeader } from "./subtitle/SubtitleHeader";
import { SubtitleList } from "./subtitle/SubtitleList";
import { VideoTabContent } from "./subtitle/VideoTabContent";

interface SubtitleEditorProps {
  isBusy?: boolean;
  file?: File | null;
  editableSegments: any[];
  setEditableSegments: React.Dispatch<React.SetStateAction<any[]>>;
  selectedIndexes: (number | string)[];
  setSelectedIndexes: React.Dispatch<React.SetStateAction<(number | string)[]>>;
  rippleDeletes: {start: number, end: number}[];
  handleLiftDelete: (indices: (number | string)[]) => void;
  handleRippleDelete: (indices: (number | string)[]) => void;
  handleVideoDelete?: (ids: string[]) => void;
  handleVideoRippleDelete?: (ids: string[]) => void;
  silenceThreshold: number;
  setSilenceThreshold: (val: number) => void;
  safePadding: number;
  setSafePadding: (val: number) => void;
  handleAutoCutSilences: () => void;
  currentTime: number;
  handleSegmentChange: (index: number, newText: string) => void;
  handleToggleSegmentSilence: (segmentIndex: number) => void;
  handleMergeSegments: (index1: number, index2: number) => void;
  handleDeleteSegments: (indices: number[]) => void;
  handleDuplicateSegment: (index: number) => void;
  handleOffsetSegments: (seconds: number) => void;
  onSeek: (time: number) => void;
  clearProject: () => void;
  downloadSRT: () => void;
  videoCanvas?: any;
  setVideoCanvas?: any;
  videoSegments?: any[];
  setVideoSegments?: any;
  selectedVideoIndexes?: string[];
}

export function SubtitleEditor({
  isBusy = false,
  file,
  editableSegments,
  setEditableSegments,
  selectedIndexes,
  setSelectedIndexes,
  rippleDeletes,
  handleLiftDelete,
  handleRippleDelete,
  handleVideoDelete,
  handleVideoRippleDelete,
  silenceThreshold,
  setSilenceThreshold,
  safePadding,
  setSafePadding,
  handleAutoCutSilences,
  currentTime,
  handleSegmentChange,
  handleToggleSegmentSilence,
  handleMergeSegments,
  handleDeleteSegments,
  handleDuplicateSegment,
  handleOffsetSegments,
  onSeek,
  clearProject,
  downloadSRT,
  videoCanvas,
  setVideoCanvas,
  videoSegments,
  setVideoSegments,
  selectedVideoIndexes,
}: SubtitleEditorProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'subtitles' | 'video'>('subtitles');
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
  const [displayActiveIndex, setDisplayActiveIndex] = useState<number>(-1);
  const lastSelectedRef = useRef<number | null>(null);
  const prevActiveIndexRef = useRef<number | null>(null);
  const scrollAnimRef = useRef<number | null>(null);

  const handleExportToImageEditor = async (projectId?: string) => {
    if (!editableSegments || editableSegments.length === 0) return;
    if (isBusy) {
      alert('Transcription is currently in progress. Please wait for transcription to complete before navigating.');
      return;
    }
    const targetIndexes = selectedIndexes.length > 0 
      ? selectedIndexes.map(Number).sort((a, b) => a - b)
      : editableSegments.map((_, i) => i);
    
    const stagedItems = targetIndexes.map(idx => {
      const seg = editableSegments[idx];
      return {
        id: `stage_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        segmentIndex: idx,
        startTime: seg.start,
        endTime: seg.end,
        frameTime: seg.start + (seg.end - seg.start) / 2, // default to midpoint
        defaultText: seg.text || '',
        customText: seg.text || '',
      };
    });

    try {
      if (projectId) {
        const { getScreencapProject, saveScreencapProject } = await import('@/lib/screencapStorage');
        const proj = await getScreencapProject(projectId);
        if (proj) {
          proj.stagedItems = [...proj.stagedItems, ...stagedItems];
          if (file && !proj.file) {
            proj.file = file;
          }
          await saveScreencapProject(proj);
          router.push(`/image-editor?id=${proj.id}`);
          return;
        }
      }
      
      const newProj = await createScreencapProject(`Screencap ${new Date().toLocaleDateString()}`, file, stagedItems);
      router.push(`/image-editor?id=${newProj.id}`);
    } catch (err) {
      console.error('Failed to export to Image Editor:', err);
      // Fallback
      localStorage.setItem('capsync_staged_captions', JSON.stringify(stagedItems));
      if (file) {
        try {
          await set('capsync_image_creator_video_blob', file);
        } catch (e) {}
      }
      router.push('/image-editor');
    }
  };

  const selectedTargetIds = useMemo(() => {
    return (selectedVideoIndexes && selectedVideoIndexes.length > 0)
      ? selectedVideoIndexes
      : (videoSegments?.filter(s => !s.deleted).map(s => s.id) || []);
  }, [selectedVideoIndexes, videoSegments]);

  const activeVideoSeg = useMemo(() => {
    return videoSegments?.find(s => selectedTargetIds.includes(s.id))
      || videoSegments?.find(s => !s.deleted)
      || videoSegments?.[0];
  }, [videoSegments, selectedTargetIds]);

  useEffect(() => {
    const handleWindowClick = () => setContextMenu(null);
    window.addEventListener('pointerdown', handleWindowClick);
    return () => window.removeEventListener('pointerdown', handleWindowClick);
  }, []);

  const toTimelineTime = (mediaTime: number) => {
    if (!videoSegments || videoSegments.length === 0) return mediaTime;
    const activeSeg = videoSegments.find(s => mediaTime >= s.sourceStart && mediaTime <= s.sourceEnd && !s.deleted);
    if (activeSeg) {
      return activeSeg.timelineStart + (mediaTime - activeSeg.sourceStart);
    }
    const closest = [...videoSegments].filter(s => !s.deleted).sort((a, b) => Math.abs(a.sourceStart - mediaTime) - Math.abs(b.sourceStart - mediaTime))[0];
    if (closest) {
      return closest.timelineStart + (mediaTime - closest.sourceStart);
    }
    return mediaTime;
  };

  const scrollToSegment = (index: number) => {
    if (index < 0) return;
    const el = document.getElementById(`subtitle-segment-${index}`);
    if (!el) return;

    const viewportEl = el.closest('[data-slot="scroll-area-viewport"]') as HTMLElement || el.closest('.overflow-y-auto') as HTMLElement || el.parentElement;
    if (!viewportEl) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const elRect = el.getBoundingClientRect();
    const viewportRect = viewportEl.getBoundingClientRect();
    const currentScrollTop = viewportEl.scrollTop;
    const relativeTop = elRect.top - viewportRect.top + currentScrollTop;
    const targetScrollTop = relativeTop - (viewportRect.height / 2) + (elRect.height / 2);
    const maxScroll = viewportEl.scrollHeight - viewportEl.clientHeight;
    const clampedTarget = Math.max(0, Math.min(targetScrollTop, maxScroll));

    if (scrollAnimRef.current !== null) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }

    // Attach interaction listeners to cancel auto-scroll if user intervenes
    if (!(viewportEl as any)._hasScrollListener) {
      const cancelAnim = () => {
        if (scrollAnimRef.current !== null) {
          cancelAnimationFrame(scrollAnimRef.current);
          scrollAnimRef.current = null;
        }
      };
      viewportEl.addEventListener('wheel', cancelAnim, { passive: true });
      viewportEl.addEventListener('touchstart', cancelAnim, { passive: true });
      viewportEl.addEventListener('mousedown', cancelAnim, { passive: true });
      (viewportEl as any)._hasScrollListener = true;
    }

    const startTop = viewportEl.scrollTop;
    const distance = clampedTarget - startTop;
    
    if (Math.abs(distance) < 2) return;

    let startTime: number | null = null;
    const duration = 300; // ms

    const animateScroll = (time: number) => {
      if (startTime === null) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      // easeOutCubic for a smooth, fast-start deceleration
      const ease = 1 - Math.pow(1 - progress, 3);
      
      viewportEl.scrollTop = startTop + distance * ease;
      
      if (progress < 1) {
        scrollAnimRef.current = requestAnimationFrame(animateScroll);
      } else {
        scrollAnimRef.current = null;
      }
    };
    
    scrollAnimRef.current = requestAnimationFrame(animateScroll);
  };

  // Auto-scroll during playback when active segment changes
  useEffect(() => {
    if (activeTab !== 'subtitles' || !editableSegments || editableSegments.length === 0) return;

    const activeIndex = editableSegments.findIndex(segment => {
      const segTlStart = toTimelineTime(segment.start);
      const segTlEnd = toTimelineTime(segment.end);
      return currentTime >= segTlStart && currentTime < segTlEnd;
    });

    if (activeIndex !== -1 && activeIndex !== prevActiveIndexRef.current) {
      prevActiveIndexRef.current = activeIndex;
      setDisplayActiveIndex(activeIndex);
      scrollToSegment(activeIndex);
    }
  }, [currentTime, editableSegments, activeTab]);

  // Toggle selection or range selection
  const handleSelection = (e: React.MouseEvent, index: number) => {
    if (e.shiftKey) {
      if (lastSelectedRef.current !== null) {
        const start = Math.min(lastSelectedRef.current, index);
        const end = Math.max(lastSelectedRef.current, index);
        const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        setSelectedIndexes(prev => {
          const newSelection = new Set(prev);
          range.forEach(r => newSelection.add(r));
          return Array.from(newSelection);
        });
      } else {
        setSelectedIndexes([index]);
        lastSelectedRef.current = index;
      }
    } else {
      // Toggle selection directly without requiring Ctrl/Cmd key
      setSelectedIndexes(prev => 
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
      );
      lastSelectedRef.current = index;
    }
  };

  const onMergeClick = () => {
    if (selectedIndexes.length === 2) {
      handleMergeSegments(Number(selectedIndexes[0]), Number(selectedIndexes[1]));
      setSelectedIndexes([]);
    }
  };

  const onLiftDeleteClick = () => {
    handleLiftDelete(selectedIndexes);
    setSelectedIndexes([]);
  };

  const onRippleDeleteClick = () => {
    handleRippleDelete(selectedIndexes);
    setSelectedIndexes([]);
  };

  // Keyboard shortcut for deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      const isLiftDeleteKey = e.key === 'Delete' || e.key === 'Backspace' || e.key.toLowerCase() === 'd';
      const isRippleDeleteKey = e.key.toLowerCase() === 'x';
      
      if ((isLiftDeleteKey || isRippleDeleteKey) && !isInput) {
        if (selectedIndexes.length > 0) {
          e.preventDefault();
          e.stopImmediatePropagation();
          
          if (isRippleDeleteKey) {
            onRippleDeleteClick();
          } else {
            onLiftDeleteClick();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [selectedIndexes, handleLiftDelete, handleRippleDelete]);

  // Only show merge button if exactly 2 are selected and they are adjacent
  const isMergeVisible = selectedIndexes.length === 2 
    && typeof selectedIndexes[0] === 'number' 
    && typeof selectedIndexes[1] === 'number' 
    && Math.abs(Number(selectedIndexes[0]) - Number(selectedIndexes[1])) === 1;

  return (
    <Card className="h-full flex flex-col bg-card border-border shadow-2xl overflow-hidden p-0 gap-0">
      <SubtitleHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        silenceThreshold={silenceThreshold}
        setSilenceThreshold={setSilenceThreshold}
        safePadding={safePadding}
        setSafePadding={setSafePadding}
        handleAutoCutSilences={handleAutoCutSilences}
        selectedIndexesCount={selectedIndexes.length}
        handleOffsetSegments={handleOffsetSegments}
        onLiftDeleteClick={onLiftDeleteClick}
        downloadSRT={downloadSRT}
        onImportSubtitles={setEditableSegments}
        onExportToImageEditor={handleExportToImageEditor}
      />
      
      {activeTab === 'subtitles' ? (
        <SubtitleList
          editableSegments={editableSegments}
          displayActiveIndex={displayActiveIndex}
          selectedIndexes={selectedIndexes}
          isMergeVisible={isMergeVisible}
          toTimelineTime={toTimelineTime}
          handleSelection={handleSelection}
          setContextMenu={setContextMenu}
          handleToggleSegmentSilence={handleToggleSegmentSilence}
          handleDuplicateSegment={handleDuplicateSegment}
          handleDeleteSegments={handleDeleteSegments}
          setSelectedIndexes={setSelectedIndexes}
          handleSegmentChange={handleSegmentChange}
          onMergeClick={onMergeClick}
          onImportSubtitles={setEditableSegments}
        />
      ) : (
        <VideoTabContent
          videoCanvas={videoCanvas}
          setVideoCanvas={setVideoCanvas}
          selectedVideoIndexes={selectedVideoIndexes}
          selectedTargetIds={selectedTargetIds}
          activeVideoSeg={activeVideoSeg}
          setVideoSegments={setVideoSegments}
        />
      )}

      {contextMenu && (
        <TimelineContextMenu
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          handleRippleDelete={handleRippleDelete}
          handleVideoRippleDelete={handleVideoRippleDelete}
          handleVideoDelete={handleVideoDelete}
          handleLiftDelete={handleLiftDelete}
        />
      )}
    </Card>
  );
}

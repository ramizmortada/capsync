import type { DragTarget } from "../../types";

const CURSOR_SIZE = 22;

const getCursorStyle = (type: 'left' | 'right' | 'both') => {
  const hs = Math.floor(CURSOR_SIZE / 2);
  let svg = '';
  if (type === 'right') {
    svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${CURSOR_SIZE}' height='${CURSOR_SIZE}' viewBox='0 0 24 24' fill='none'><g stroke='black' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='M3 5v14'/><path d='M21 12H7'/><path d='m15 18 6-6-6-6'/></g><g stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M3 5v14'/><path d='M21 12H7'/><path d='m15 18 6-6-6-6'/></g></svg>`;
  } else if (type === 'left') {
    svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${CURSOR_SIZE}' height='${CURSOR_SIZE}' viewBox='0 0 24 24' fill='none'><g stroke='black' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='m9 6-6 6 6 6'/><path d='M3 12h14'/><path d='M21 19V5'/></g><g stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m9 6-6 6 6 6'/><path d='M3 12h14'/><path d='M21 19V5'/></g></svg>`;
  } else {
    svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${CURSOR_SIZE}' height='${CURSOR_SIZE}' viewBox='0 0 24 24' fill='none'><g stroke='black' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></g><g stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></g></svg>`;
  }
  const fallback = type === 'right' ? 'e-resize' : type === 'left' ? 'w-resize' : 'col-resize';
  return { cursor: `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hs} ${hs}, ${fallback}` };
};

interface TimelineBoundariesProps {
  zoomLevel: number;
  editableSegments: any[];
  toTimelineTime: (mediaTime: number) => number;
  timelineDuration: number;
  draggingBoundary: DragTarget | null;
  setDraggingBoundary: (val: DragTarget | null) => void;
}

export const TimelineBoundaries = ({
  zoomLevel,
  editableSegments,
  toTimelineTime,
  timelineDuration,
  draggingBoundary,
  setDraggingBoundary,
}: TimelineBoundariesProps) => {
  if (zoomLevel < 3) return null;

  return (
    <>
      {/* First segment start boundary */}
      {editableSegments.length > 0 && (
        <div
          onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary('start'); }}
          className="absolute top-0 bottom-0 w-8 -ml-4 z-30 flex justify-center items-center group"
          style={{ left: `${(toTimelineTime(editableSegments[0].start) / timelineDuration) * 100}%`, ...getCursorStyle('right') }}
        >
          <div className={`w-0.5 h-full transition-colors ${draggingBoundary === 'start' ? 'bg-emerald-400 w-1' : 'bg-accent-blue/40 group-hover:bg-emerald-400 group-hover:w-1'}`} />
        </div>
      )}

      {/* Boundaries for segments */}
      {editableSegments.map((segment, index) => {
        const elements: any[] = [];

        if (zoomLevel >= 15 && segment.words && segment.words.length > 0) {
          // Render word/gap level boundary elements
          segment.words.forEach((word: any, wIdx: number) => {
            const nextWord = segment.words[wIdx + 1];
            
            // Boundary between current item and next item
            if (nextWord) {
              const leftPercent = (toTimelineTime(word.end) / timelineDuration) * 100;
              const isDraggingThisBoth = draggingBoundary && typeof draggingBoundary === 'object' && draggingBoundary.type === 'both' && 'wordIdx' in draggingBoundary && draggingBoundary.wordIdx === wIdx;
              
              elements.push(
                <div 
                  key={`cluster-${index}-${wIdx}`} 
                  className="absolute top-0 bottom-0 w-8 -ml-4 z-50 flex justify-center items-center group" 
                  style={{ left: `${leftPercent}%`, ...getCursorStyle('both') }}
                  onMouseDown={(e) => { 
                    e.preventDefault(); 
                    setDraggingBoundary({ type: 'both', segmentIdx: index, wordIdx: wIdx }); 
                  }}
                >
                  {/* Single double-sided handle dividing the blocks */}
                  <div className={`h-full transition-colors ${isDraggingThisBoth ? 'bg-emerald-400 w-1' : 'bg-accent-blue/40 w-0.5 group-hover:bg-emerald-400 group-hover:w-1'}`} />
                </div>
              );
            }
          });

          // Render parent segment boundary handles when zoomed in
          if (index < editableSegments.length - 1) {
            const leftPercent = (toTimelineTime(segment.end) / timelineDuration) * 100;
            const isDraggingThisBoth = draggingBoundary && typeof draggingBoundary === 'object' && draggingBoundary.type === 'both' && 'index' in draggingBoundary && draggingBoundary.index === index;
            
            elements.push(
              <div 
                key={`parent-cluster-${index}`} 
                className="absolute top-0 bottom-0 w-8 -ml-4 z-50 flex justify-center items-center group" 
                style={{ left: `${leftPercent}%`, ...getCursorStyle('both') }}
                onMouseDown={(e) => { 
                  e.preventDefault(); 
                  setDraggingBoundary({ type: 'both', index }); 
                }}
              >
                <div className={`h-full transition-colors ${isDraggingThisBoth ? 'bg-orange-500 w-1' : 'bg-orange-500/40 w-0.5 group-hover:bg-orange-400 group-hover:w-1'}`} />
              </div>
            );
          } else {
            // Last parent segment boundary handle
            const leftPercent = (toTimelineTime(segment.end) / timelineDuration) * 100;
            elements.push(
              <div 
                key={`parent-end-${index}`} 
                className="absolute top-0 bottom-0 w-8 -ml-4 z-50 flex justify-center items-center group" 
                style={{ left: `${leftPercent}%`, ...getCursorStyle('left') }}
                onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary('end'); }}
              >
                <div className={`w-0.5 h-full transition-colors ${draggingBoundary === 'end' ? 'bg-orange-500 w-1' : 'bg-orange-500/40 group-hover:bg-orange-400 group-hover:w-1'}`} />
              </div>
            );
          }
        } else if (index < editableSegments.length - 1) {
          const nextSegment = editableSegments[index + 1];
          const isTouching = nextSegment.start - segment.end <= 0.05;

          if (isTouching) {
            const leftPercent = (toTimelineTime(segment.end) / timelineDuration) * 100;
            const isDraggingThisBoth = draggingBoundary && typeof draggingBoundary === 'object' && draggingBoundary.type === 'both' && 'index' in draggingBoundary && draggingBoundary.index === index;
            
            elements.push(
              <div key={`cluster-${index}`} className="absolute top-0 bottom-0 w-16 -ml-8 z-30 flex" style={{ left: `${leftPercent}%` }}>
                <div 
                  className="flex-1 group flex justify-end" 
                  style={getCursorStyle('left')}
                  onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary({ type: 'end', index }); }}
                >
                  <div className="w-1 h-full bg-transparent group-hover:bg-emerald-400/30 transition-colors" />
                </div>
                <div 
                  className="w-2 shrink-0 group flex justify-center items-center relative z-20"
                  style={getCursorStyle('both')}
                  onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary({ type: 'both', index }); }}
                >
                  <div className={`h-full transition-colors ${isDraggingThisBoth ? 'bg-emerald-400 w-1' : 'bg-accent-blue/40 w-0.5 group-hover:bg-emerald-400 group-hover:w-1'}`} />
                </div>
                <div 
                  className="flex-1 group flex justify-start"
                  style={getCursorStyle('right')}
                  onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary({ type: 'start', index: index + 1 }); }}
                >
                  <div className="w-1 h-full bg-transparent group-hover:bg-emerald-400/30 transition-colors" />
                </div>
              </div>
            );
          } else {
            const leftPercent1 = (toTimelineTime(segment.end) / timelineDuration) * 100;
            const leftPercent2 = (toTimelineTime(nextSegment.start) / timelineDuration) * 100;
            
            elements.push(
              <div 
                key={`end-${index}`} 
                className="absolute top-0 bottom-0 w-8 -ml-4 z-30 flex justify-center items-center group" 
                style={{ left: `${leftPercent1}%`, ...getCursorStyle('left') }}
                onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary({ type: 'end', index }); }}
              >
                <div className="w-0.5 h-full bg-accent-blue/40 transition-colors group-hover:bg-emerald-400 group-hover:w-1" />
              </div>
            );
            
            elements.push(
              <div 
                key={`start-${index + 1}`} 
                className="absolute top-0 bottom-0 w-8 -ml-4 z-30 flex justify-center items-center group" 
                style={{ left: `${leftPercent2}%`, ...getCursorStyle('right') }}
                onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary({ type: 'start', index: index + 1 }); }}
              >
                <div className="w-0.5 h-full bg-accent-blue/40 transition-colors group-hover:bg-emerald-400 group-hover:w-1" />
              </div>
            );
          }
        } else {
          const leftPercent = (toTimelineTime(segment.end) / timelineDuration) * 100;
          elements.push(
            <div 
              key={`end-${index}`} 
              className="absolute top-0 bottom-0 w-8 -ml-4 z-30 flex justify-center items-center group" 
              style={{ left: `${leftPercent}%`, ...getCursorStyle('left') }}
              onMouseDown={(e) => { e.preventDefault(); setDraggingBoundary('end'); }}
            >
              <div className={`w-0.5 h-full transition-colors ${draggingBoundary === 'end' ? 'bg-emerald-400 w-1' : 'bg-accent-blue/40 group-hover:bg-emerald-400 group-hover:w-1'}`} />
            </div>
          );
        }

        return elements;
      })}
    </>
  );
};

import React, { useMemo } from 'react';

interface AudioWaveformProps {
  peaks: number[];
  mediaDuration: number;
  timelineDuration: number;
  toTimelineTime: (mediaTime: number) => number;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  peaks,
  mediaDuration,
  timelineDuration,
  toTimelineTime
}) => {
  const pathData = useMemo(() => {
    if (peaks.length === 0 || mediaDuration <= 0 || timelineDuration <= 0) return '';

    let d = '';
    const numPeaks = peaks.length;
    let lastValidX = -1;

    for (let i = 0; i < numPeaks; i++) {
      const mediaTime = (i / numPeaks) * mediaDuration;
      const timelineTime = toTimelineTime(mediaTime);
      
      // Calculate X coordinate as a percentage (0 to 100)
      const x = (timelineTime / timelineDuration) * 100;
      
      // The Y coordinate will be between 0 and 1. We'll map it to SVG viewBox (0 to 100 height)
      // Since it's a waveform, we can draw it from the center (50) up and down
      const amplitude = peaks[i] * 50; // max 50 up, 50 down
      
      // If x hasn't advanced (meaning we are inside a cut zone where timelineTime is flat), we skip drawing to avoid vertical stacking
      if (x === lastValidX) continue;
      
      const y1 = 50 - amplitude;
      const y2 = 50 + amplitude;

      // Draw a vertical line for this peak
      // M x y1 L x y2
      d += `M ${x.toFixed(3)} ${y1.toFixed(1)} L ${x.toFixed(3)} ${y2.toFixed(1)} `;
      
      lastValidX = x;
    }

    return d;
  }, [peaks, mediaDuration, timelineDuration, toTimelineTime]);

  if (peaks.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-0 opacity-100">
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="waveform-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path 
          d={pathData} 
          stroke="url(#waveform-gradient)" 
          strokeWidth="0.3" 
          strokeLinecap="round"
          fill="none" 
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
};

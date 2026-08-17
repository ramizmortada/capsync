import React, { useMemo } from 'react';

interface AudioWaveformProps {
  peaks: number[];
  mediaDuration: number;
  sourceStart?: number;
  sourceEnd?: number;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  peaks,
  mediaDuration,
  sourceStart,
  sourceEnd,
}) => {
  const pathData = useMemo(() => {
    if (peaks.length === 0 || mediaDuration <= 0) return '';

    const sStart = Math.max(0, sourceStart ?? 0);
    const sEnd = Math.min(mediaDuration, Math.max(sStart + 0.01, sourceEnd ?? mediaDuration));

    const totalPeaks = peaks.length;
    const startIndex = Math.min(totalPeaks - 1, Math.max(0, Math.floor((sStart / mediaDuration) * totalPeaks)));
    const endIndex = Math.min(totalPeaks, Math.max(startIndex + 1, Math.ceil((sEnd / mediaDuration) * totalPeaks)));

    const clipPeaks = peaks.slice(startIndex, endIndex);
    if (clipPeaks.length === 0) return '';

    let d = '';
    const numClipPeaks = clipPeaks.length;

    for (let i = 0; i < numClipPeaks; i++) {
      const x = numClipPeaks > 1 ? (i / (numClipPeaks - 1)) * 100 : 50;
      const amplitude = Math.max(0.04, clipPeaks[i]) * 44;
      const y1 = 50 - amplitude;
      const y2 = 50 + amplitude;

      d += `M ${x.toFixed(3)} ${y1.toFixed(1)} L ${x.toFixed(3)} ${y2.toFixed(1)} `;
    }

    return d;
  }, [peaks, mediaDuration, sourceStart, sourceEnd]);

  if (peaks.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-0 opacity-80">
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="waveform-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="1" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path 
          d={pathData} 
          stroke="url(#waveform-gradient)" 
          strokeWidth="0.4" 
          strokeLinecap="round"
          fill="none" 
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
};

import { useState, useEffect } from "react";

export function useAudioWaveform(file: File | null) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!file) {
      setPeaks([]);
      return;
    }

    let isMounted = true;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    const generateWaveform = async () => {
      try {
        setIsGenerating(true);
        const arrayBuffer = await file.arrayBuffer();
        
        // Decode audio data
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        if (!isMounted) return;

        // Downsample the audio data into "peaks" (e.g., 2000 points)
        const channelData = audioBuffer.getChannelData(0); // Use the first channel
        const numPeaks = 3000; // Resolution of the waveform
        const step = Math.ceil(channelData.length / numPeaks);
        
        const newPeaks = [];
        for (let i = 0; i < numPeaks; i++) {
          const start = i * step;
          const end = Math.min(start + step, channelData.length);
          let sum = 0;
          for (let j = start; j < end; j++) {
            sum += Math.abs(channelData[j]);
          }
          // Calculate average amplitude for this chunk
          newPeaks.push(sum / (end - start));
        }

        // Normalize peaks between 0 and 1
        const maxPeak = Math.max(...newPeaks, 0.001); // Prevent division by zero
        const normalizedPeaks = newPeaks.map(p => p / maxPeak);

        if (isMounted) {
          setPeaks(normalizedPeaks);
          setIsGenerating(false);
        }
      } catch (error) {
        console.error("Failed to generate audio waveform:", error);
        if (isMounted) {
          setIsGenerating(false);
        }
      }
    };

    generateWaveform();

    return () => {
      isMounted = false;
      audioContext.close().catch(() => {});
    };
  }, [file]);

  return { peaks, isGenerating };
}

import { formatUiTime } from "@/lib/utils";

interface TimeRulerProps {
  timelineDuration: number;
  zoomLevel: number;
}

export const TimeRuler = ({ timelineDuration, zoomLevel }: TimeRulerProps) => {
  if (timelineDuration <= 0) return null;
  let intervalSeconds = 5;
  if (zoomLevel >= 30) intervalSeconds = 0.1;
  else if (zoomLevel >= 15) intervalSeconds = 0.5;
  else if (zoomLevel >= 4) intervalSeconds = 1;
  else if (zoomLevel >= 2) intervalSeconds = 2;
  else if (timelineDuration > 300) intervalSeconds = 15;
  else if (timelineDuration > 60) intervalSeconds = 10;
  
  const numTicks = Math.floor(timelineDuration / intervalSeconds);
  const ticks = Array.from({ length: numTicks + 1 }, (_, i) => i * intervalSeconds);
  
  return (
    <>
      {ticks.map(tick => {
        const leftPercent = (tick / timelineDuration) * 100;
        return (
          <div 
            key={`tick-${tick}`} 
            className="absolute top-0 text-[10px] text-neutral-500 pointer-events-none transform -translate-x-1/2" 
            style={{ left: `${leftPercent}%` }}
          >
            {formatUiTime(tick)}
          </div>
        );
      })}
    </>
  );
};

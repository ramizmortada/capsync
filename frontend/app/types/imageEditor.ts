import { SubtitleStyle } from '../types';

export interface FrameTransform {
  scale: number; // 1.0 to 3.0
  offsetX: number; // -100 to +100 (%)
  offsetY: number; // -100 to +100 (%)
}

export interface StagedFrameItem {
  id: string;
  segmentIndex: number;
  startTime: number;
  endTime: number;
  frameTime: number; // chosen timestamp within [startTime, endTime]
  defaultText: string;
  customText: string;
  transform?: FrameTransform;
}

export type AspectRatioPreset = 'auto' | '1:1' | '9:16' | '16:9' | '4:5';

export interface CanvasComposition {
  id: string;
  title: string;
  frameIds: string[]; // references to StagedFrameItem ids
  layoutId: string;
  aspectPreset: AspectRatioPreset;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
  gap: number;
  padding: number;
  backgroundColor: string;
  showBorders: boolean;
  subtitleStyle: Partial<SubtitleStyle>;
}

export interface CanvasLayoutTemplate {
  id: string;
  name: string;
  frameCount: number; // expected number of frames
  boxes: Array<{ x: number; y: number; w: number; h: number }>;
}

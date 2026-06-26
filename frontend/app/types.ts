export interface SubtitleStyle {
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  textColor: string;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadow3DEnabled?: boolean;
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  highlightColor: string;
  alignment: 'left' | 'center' | 'right';
  alignmentVertical: 'top' | 'middle' | 'bottom';
  positionY: number;
  animationStyle: 'none' | 'color' | 'box' | 'scale' | 'karaoke' | 'reveal';
  animationIn: 'none' | 'fade' | 'zoomIn' | 'zoomOut';
  animationOut: 'none' | 'fade' | 'zoomIn' | 'zoomOut';
  highlightBackgroundColor: string;
  scaleFactor: number;
  maxWidth: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface StylePreset {
  id: string;
  name: string;
  subtitleStyle: SubtitleStyle;
  modelSize: string;
  maxWords: string;
  isDefault?: boolean;
}

export const DEFAULT_PRESETS: StylePreset[] = [
  {
    id: "default-studio",
    name: "Default",
    modelSize: "tiny",
    maxWords: "-1",
    isDefault: true,
    subtitleStyle: {
      fontFamily: "Inter",
      fontWeight: "500",
      fontSize: 50,
      textColor: "#ffffff",
      strokeEnabled: true,
      strokeColor: "#000000",
      strokeWidth: 2,
      shadowEnabled: false,
      shadowColor: "#000000",
      shadowOffsetX: 0,
      shadowOffsetY: 8,
      shadowBlur: 10,
      shadow3DEnabled: false,
      backgroundEnabled: false,
      backgroundColor: "#000000",
      backgroundOpacity: 50,
      highlightColor: "#ffff00",
      alignment: 'center',
      alignmentVertical: 'top',
      positionY: 70,
      animationStyle: 'none',
      animationIn: 'none',
      animationOut: 'none',
      highlightBackgroundColor: "#ff0000",
      scaleFactor: 1.2,
      maxWidth: 100,
      textTransform: 'none',
    }
  }
];

export type DragTarget = 
  | { type: 'start' | 'end' | 'both', index: number } 
  | { type: 'start' | 'end' | 'both', segmentIdx: number, wordIdx: number }
  | 'start' | 'end';

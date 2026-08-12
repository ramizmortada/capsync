import { CanvasLayoutTemplate } from '../../types/imageEditor';

export const LAYOUT_TEMPLATES: Record<string, CanvasLayoutTemplate> = {
  // 1 Frame
  'single': {
    id: 'single',
    name: 'Single Full Frame',
    frameCount: 1,
    boxes: [{ x: 0, y: 0, w: 1, h: 1 }]
  },

  // 2 Frames
  'stack-2': {
    id: 'stack-2',
    name: '2-Panel Vertical Stack',
    frameCount: 2,
    boxes: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 }
    ]
  },
  'side-2': {
    id: 'side-2',
    name: '2-Panel Side-by-Side',
    frameCount: 2,
    boxes: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 }
    ]
  },

  // 3 Frames
  'stack-3': {
    id: 'stack-3',
    name: '3-Panel Vertical Stack',
    frameCount: 3,
    boxes: [
      { x: 0, y: 0, w: 1, h: 1/3 },
      { x: 0, y: 1/3, w: 1, h: 1/3 },
      { x: 0, y: 2/3, w: 1, h: 1/3 }
    ]
  },
  'top1-bot2': {
    id: 'top1-bot2',
    name: '1 Top / 2 Bottom Split',
    frameCount: 3,
    boxes: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
    ]
  },
  'top2-bot1': {
    id: 'top2-bot1',
    name: '2 Top / 1 Bottom Split',
    frameCount: 3,
    boxes: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 }
    ]
  },

  // 4 Frames
  'grid-2x2': {
    id: 'grid-2x2',
    name: '2x2 Grid',
    frameCount: 4,
    boxes: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
    ]
  },
  'stack-4': {
    id: 'stack-4',
    name: '4-Panel Vertical Stack',
    frameCount: 4,
    boxes: [
      { x: 0, y: 0, w: 1, h: 0.25 },
      { x: 0, y: 0.25, w: 1, h: 0.25 },
      { x: 0, y: 0.5, w: 1, h: 0.25 },
      { x: 0, y: 0.75, w: 1, h: 0.25 }
    ]
  },
  'featured-left-3': {
    id: 'featured-left-3',
    name: '1 Left / 3 Right Stack',
    frameCount: 4,
    boxes: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1/3 },
      { x: 0.5, y: 1/3, w: 0.5, h: 1/3 },
      { x: 0.5, y: 2/3, w: 0.5, h: 1/3 }
    ]
  }
};

export function getTemplatesForFrameCount(count: number): CanvasLayoutTemplate[] {
  if (count <= 1) {
    return [LAYOUT_TEMPLATES['single']];
  }
  if (count === 2) {
    return [LAYOUT_TEMPLATES['stack-2'], LAYOUT_TEMPLATES['side-2']];
  }
  if (count === 3) {
    return [LAYOUT_TEMPLATES['stack-3'], LAYOUT_TEMPLATES['top1-bot2'], LAYOUT_TEMPLATES['top2-bot1']];
  }
  if (count === 4) {
    return [LAYOUT_TEMPLATES['grid-2x2'], LAYOUT_TEMPLATES['stack-4'], LAYOUT_TEMPLATES['featured-left-3']];
  }
  // Generic N-frame grid generator for 5+
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const boxes: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    boxes.push({
      x: c / cols,
      y: r / rows,
      w: 1 / cols,
      h: 1 / rows
    });
  }
  return [
    {
      id: `generic-grid-${count}`,
      name: `${cols}x${rows} Custom Grid`,
      frameCount: count,
      boxes
    },
    {
      id: `generic-stack-${count}`,
      name: `${count}-Panel Vertical Stack`,
      frameCount: count,
      boxes: Array.from({ length: count }, (_, i) => ({
        x: 0,
        y: i / count,
        w: 1,
        h: 1 / count
      }))
    }
  ];
}

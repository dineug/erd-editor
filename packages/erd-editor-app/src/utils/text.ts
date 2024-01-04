const TextFontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI (Custom)', Roboto, 'Helvetica Neue', 'Open Sans (Custom)', system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'" as const;

let canvas: OffscreenCanvas | null = null;
let canvasContext: OffscreenCanvasRenderingContext2D | null = null;

const TEXT_PADDING = 2;

function getCanvas(): OffscreenCanvas | null {
  if (canvas) {
    return canvas;
  }

  try {
    canvas = new OffscreenCanvas(0, 0);
  } catch {}

  return canvas;
}

function getCanvasContext() {
  if (canvasContext) {
    return canvasContext;
  }

  const canvas = getCanvas();
  if (!canvas) return null;

  canvasContext = canvas.getContext('2d');
  if (canvasContext) {
    canvasContext.font = `400 12px ${TextFontFamily}`;
  }
  return canvasContext;
}

export function toWidth(text: string) {
  const canvasContext = getCanvasContext();
  let width = 0;

  if (canvasContext) {
    width = canvasContext
      ? canvasContext.measureText(text).width
      : text.length * 11;
  }

  return Math.round(width) + TEXT_PADDING;
}

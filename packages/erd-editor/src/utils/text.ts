let canvas: HTMLCanvasElement | null = null;
let canvasContext: CanvasRenderingContext2D | null;

function getCanvas() {
  if (canvas) {
    return canvas;
  }

  canvas = document.createElement('canvas');
  return canvas;
}

function getCanvasContext() {
  const canvas = getCanvas();

  if (canvasContext) {
    return canvasContext;
  }

  canvasContext = canvas.getContext('2d');
  if (canvasContext) {
    canvasContext.font = `13px 'Noto Sans', sans-serif`;
  }
  return canvasContext;
}

export function createText() {
  const canvasContext = getCanvasContext();
  const span = document.createElement('span');
  span.className = 'ghost-text';

  const toWidth = (text: string) => {
    if (canvasContext) {
      return canvasContext.measureText(text).width;
    }

    span.innerText = text;
    return span.offsetWidth;
  };

  return {
    span,
    toWidth,
  };
}

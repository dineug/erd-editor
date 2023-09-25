import { css } from '@dineug/r-html';

import { TextFontFamily } from '@/styles/fonts.styles';
import { typography } from '@/styles/typography.styles';

let canvas: HTMLCanvasElement | null = null;
let canvasContext: CanvasRenderingContext2D | null;

const ghostText = css`
  visibility: hidden;
  position: fixed;
  top: -100px;
  white-space: nowrap;
  font-family: var(--text-font-family);
  ${typography.paragraph};
`;

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
    canvasContext.font = `400 12px ${TextFontFamily}`;
  }
  return canvasContext;
}

export function createText() {
  const canvasContext = getCanvasContext();
  const span = document.createElement('span');
  span.className = ghostText.toString();

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

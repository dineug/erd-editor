import { css } from '@dineug/r-html';

import { TextFontFamily } from '@/styles/fonts.styles';
import { typography } from '@/styles/typography.styles';

let canvas: HTMLCanvasElement | null = null;
let canvasContext: CanvasRenderingContext2D | null;

const TEXT_PADDING = 2;

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
    let width = 0;

    if (canvasContext) {
      width = canvasContext.measureText(text).width;
    } else {
      span.innerText = text;
      width = span.offsetWidth;
    }

    return Math.round(width) + TEXT_PADDING;
  };

  return {
    span,
    toWidth,
  };
}

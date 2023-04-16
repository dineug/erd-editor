import {
  createContext,
  defineCustomElement,
  FC,
  html,
  useProvider,
} from '@dineug/r-html';
import * as PIXI from 'pixi.js';

declare global {
  interface HTMLElementTagNameMap {
    'r-erd-canvas': CanvasElement;
  }
}

export type CanvasContext = PIXI.Application;

export const canvasContext = createContext<CanvasContext | null>(null);

export interface CanvasElement extends HTMLElement {}

const Canvas: FC<{}, CanvasElement> = (props, ctx) => {
  const app = new PIXI.Application();
  useProvider(ctx, canvasContext, app);

  if (import.meta.env.DEV) {
    Reflect.set(globalThis, '__PIXI_APP__', app);
  }

  return () => html`${app.view}`;
};

defineCustomElement('r-erd-canvas', {
  shadow: false,
  render: Canvas,
});

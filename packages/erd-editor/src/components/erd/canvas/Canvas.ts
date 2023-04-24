import {
  createContext,
  defineCustomElement,
  FC,
  html,
  useProvider,
} from '@dineug/r-html';
import { Application } from 'pixi.js';

declare global {
  interface HTMLElementTagNameMap {
    'r-erd-canvas': CanvasElement;
  }
}

export const canvasContext = createContext<Application | null>(null);

export type CanvasProps = {};

export interface CanvasElement extends HTMLElement {
  app: Application;
}

const Canvas: FC<CanvasProps, CanvasElement> = (props, ctx) => {
  const app = new Application({ antialias: true });
  useProvider(ctx, canvasContext, app);
  ctx.app = app;

  if (import.meta.env.DEV) {
    Reflect.set(globalThis, '__PIXI_APP__', app);
  }

  return () => html`${app.view}`;
};

defineCustomElement('r-erd-canvas', {
  shadow: false,
  render: Canvas,
});

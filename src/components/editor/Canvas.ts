import './memo/Memo';

import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { useContext } from '@/core/hooks/context.hook';
import { CanvasStyle } from './Canvas.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-canvas': CanvasElement;
  }
}

export interface CanvasProps {}

export interface CanvasElement extends CanvasProps, HTMLElement {}

const Canvas: FunctionalComponent<CanvasProps, CanvasElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);

  return () => {
    const { canvasState } = contextRef.value.store;

    return html`
      <div
        class="vuerd-canvas"
        style=${styleMap({
          width: `${canvasState.width}px`,
          height: `${canvasState.height}px`,
          top: `${canvasState.scrollTop}px`,
          left: `${canvasState.scrollLeft}px`,
        })}
      >
        <vuerd-memo></vuerd-memo>
      </div>
    `;
  };
};

defineComponent('vuerd-canvas', {
  style: CanvasStyle,
  render: Canvas,
});

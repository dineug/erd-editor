import './memo/Memo';
import './table/Table';

import {
  defineComponent,
  html,
  FunctionalComponent,
  beforeMount,
  watch,
} from '@dineug/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { repeat } from 'lit-html/directives/repeat';
import { useContext } from '@/core/hooks/context.hook';
import { useRenderTrigger } from '@/core/hooks/renderTrigger.hook';
import { useDestroy } from '@/core/hooks/destroy.hook';

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
  const destroy = useDestroy();
  const { render, trigger } = useRenderTrigger();

  beforeMount(() => {
    const {
      memoState: { memos },
      tableState: { tables },
    } = contextRef.value.store;

    destroy.push(watch(tables, render), watch(memos, render));
  });

  return () => {
    const {
      canvasState,
      memoState: { memos },
      tableState: { tables },
    } = contextRef.value.store;
    trigger();

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
        ${repeat(
          tables,
          table => table.id,
          table => html`<vuerd-table .table=${table}></vuerd-table>`
        )}
        ${repeat(
          memos,
          memo => memo.id,
          memo => html`<vuerd-memo .memo=${memo}></vuerd-memo>`
        )}
      </div>
    `;
  };
};

defineComponent('vuerd-canvas', {
  shadow: false,
  render: Canvas,
});

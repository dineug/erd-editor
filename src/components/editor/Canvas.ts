import './memo/Memo';
import './table/Table';
import './DrawRelationship';
import './CanvasSVG';

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
import { useUnmounted } from '@/core/hooks/unmounted.hook';

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
  const { unmountedGroup } = useUnmounted();
  const { renderTrigger } = useRenderTrigger();

  beforeMount(() => {
    const {
      memoState: { memos },
      tableState: { tables },
    } = contextRef.value.store;

    unmountedGroup.push(
      watch(tables, renderTrigger),
      watch(memos, renderTrigger)
    );
  });

  return () => {
    const {
      canvasState: { width, height, scrollTop, scrollLeft, zoomLevel, show },
      memoState: { memos },
      tableState: { tables },
      editorState: { drawRelationship },
    } = contextRef.value.store;

    return html`
      <div
        class="vuerd-canvas"
        style=${styleMap({
          width: `${width}px`,
          height: `${height}px`,
          top: `${scrollTop}px`,
          left: `${scrollLeft}px`,
          transform: `scale(${zoomLevel})`,
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
        ${show.relationship
          ? html`<vuerd-canvas-svg></vuerd-canvas-svg>`
          : null}
        ${drawRelationship?.start
          ? html`
              <vuerd-draw-relationship
                .draw=${drawRelationship}
              ></vuerd-draw-relationship>
            `
          : null}
      </div>
    `;
  };
};

defineComponent('vuerd-canvas', {
  shadow: false,
  render: Canvas,
});

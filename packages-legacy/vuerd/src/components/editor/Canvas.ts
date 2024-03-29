import './memo/Memo';
import './table/Table';
import './table/HighLevelTable';
import './DrawRelationship';
import './CanvasSVG';

import {
  beforeMount,
  defineComponent,
  FunctionalComponent,
  html,
  watch,
} from '@vuerd/lit-observable';
import { cache } from 'lit-html/directives/cache';
import { repeat } from 'lit-html/directives/repeat';
import { styleMap } from 'lit-html/directives/style-map';

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
        class="vuerd-canvas-controller"
        style=${styleMap({
          width: `${width}px`,
          height: `${height}px`,
          minWidth: `${width}px`,
          minHeight: `${height}px`,
          transform: `translate(${scrollLeft}px, ${scrollTop}px) scale(${zoomLevel})`,
        })}
      >
        <div
          class="vuerd-canvas"
          style=${styleMap({
            width: `${width}px`,
            height: `${height}px`,
            minWidth: `${width}px`,
            minHeight: `${height}px`,
          })}
        >
          ${cache(
            zoomLevel > 0.7
              ? repeat(
                  tables,
                  table => table.id,
                  table => html`<vuerd-table .table=${table}></vuerd-table>`
                )
              : repeat(
                  tables,
                  table => table.id,
                  table => html`
                    <vuerd-high-level-table
                      .table=${table}
                    ></vuerd-high-level-table>
                  `
                )
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
      </div>
    `;
  };
};

defineComponent('vuerd-canvas', {
  shadow: false,
  render: Canvas,
});

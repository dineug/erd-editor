import './Table';
import './Memo';
import './MinimapHandle';

import {
  beforeMount,
  defineComponent,
  FunctionalComponent,
  html,
  query,
  svg,
  watch,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { repeat } from 'lit-html/directives/repeat';
import { styleMap } from 'lit-html/directives/style-map';

import { relationshipTpl } from '@/components/editor/Relationship.template';
import { isMouseEvent } from '@/core/helper/dom.helper';
import { getViewport } from '@/core/helper/dragSelect.helper';
import { useContext } from '@/core/hooks/context.hook';
import { useRenderTrigger } from '@/core/hooks/renderTrigger.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { SIZE_MINIMAP_MARGIN, SIZE_MINIMAP_WIDTH } from '@/core/layout';
import { moveCanvas } from '@/engine/command/canvas.cmd.helper';

import { useMinimapScroll } from './useMinimapScroll';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-minimap': MinimapElement;
  }
}

export interface MinimapProps {
  width: number;
  height: number;
}

export interface MinimapElement extends MinimapProps, HTMLElement {}

const Minimap: FunctionalComponent<MinimapProps, MinimapElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  const { unmountedGroup } = useUnmounted();
  const { renderTrigger } = useRenderTrigger();
  const { state, onScrollStart } = useMinimapScroll(ctx);
  const minimapRef = query<HTMLElement>('.vuerd-minimap');

  const getRatio = () => {
    const { store } = contextRef.value;
    return SIZE_MINIMAP_WIDTH / store.canvasState.width;
  };

  const getStyleMap = () => {
    const { width, height } = contextRef.value.store.canvasState;
    const ratio = SIZE_MINIMAP_WIDTH / width;
    const x = (-1 * width) / 2 + SIZE_MINIMAP_WIDTH / 2;
    const y = (-1 * height) / 2 + (height * ratio) / 2;
    const right = x + SIZE_MINIMAP_MARGIN;
    const top = y + SIZE_MINIMAP_MARGIN;
    return {
      transform: `scale(${ratio})`,
      width: `${width}px`,
      height: `${height}px`,
      right: `${right}px`,
      top: `${top}px`,
    };
  };

  const getShadowStyle = () => {
    const top = SIZE_MINIMAP_MARGIN;
    return {
      width: `${SIZE_MINIMAP_WIDTH}px`,
      height: `${SIZE_MINIMAP_WIDTH}px`,
      right: `${SIZE_MINIMAP_MARGIN}px`,
      top: `${top}px`,
    };
  };

  const handleMove = (event: MouseEvent | TouchEvent) => {
    const { store } = contextRef.value;
    const viewport = getViewport(store);
    const ratio = getRatio();
    const $minimap = minimapRef.value;
    const rect = $minimap.getBoundingClientRect();
    const clientX = isMouseEvent(event)
      ? event.clientX
      : event.touches[0].clientX;
    const clientY = isMouseEvent(event)
      ? event.clientY
      : event.touches[0].clientY;

    const x = clientX - rect.x;
    const y = clientY - rect.y;
    const absoluteX = x / ratio;
    const absoluteY = y / ratio;
    const scrollLeft = absoluteX - viewport.width / 2;
    const scrollTop = absoluteY - viewport.height / 2;

    store.dispatch(moveCanvas(-1 * scrollTop, -1 * scrollLeft));

    onScrollStart(event);
  };

  beforeMount(() => {
    const {
      memoState: { memos },
      tableState: { tables },
      relationshipState: { relationships },
    } = contextRef.value.store;

    unmountedGroup.push(
      watch(tables, renderTrigger),
      watch(memos, renderTrigger),
      watch(relationships, renderTrigger)
    );
  });

  return () => {
    const {
      canvasState: { width, height, zoomLevel, show },
      tableState: { tables },
      memoState: { memos },
      relationshipState: { relationships },
    } = contextRef.value.store;

    return html`
      <div
        class="vuerd-minimap-shadow"
        style=${styleMap(getShadowStyle())}
      ></div>
      <div
        class="vuerd-minimap"
        style=${styleMap(getStyleMap())}
        @mousedown=${handleMove}
        @touchstart=${handleMove}
      >
        <div class="vuerd-erd-background"></div>
        <div
          class="vuerd-canvas"
          style=${styleMap({
            width: `${width}px`,
            height: `${height}px`,
            transform: `scale(${zoomLevel})`,
          })}
        >
          ${repeat(
            tables,
            table => table.id,
            table => html`
              <vuerd-minimap-table .table=${table}></vuerd-minimap-table>
            `
          )}
          ${repeat(
            memos,
            memo => memo.id,
            memo =>
              html`<vuerd-minimap-memo .memo=${memo}></vuerd-minimap-memo>`
          )}
          ${show.relationship
            ? svg`
              <svg
                class="vuerd-canvas-svg"
                style=${styleMap({
                  width: `${width}px`,
                  height: `${height}px`,
                })}
              >
              ${repeat(
                relationships,
                relationship => relationship.id,
                relationship =>
                  svg`
                      <g
                        class=${classMap({
                          'vuerd-relationship': true,
                          identification: relationship.identification,
                        })}
                      >
                        ${relationshipTpl(relationship, 12)}
                      </g>
                  `
              )}
              </svg>
          `
            : null}
        </div>
      </div>
      <vuerd-minimap-handle .selected=${state.selected}></vuerd-minimap-handle>
    `;
  };
};

defineComponent('vuerd-minimap', {
  observedProps: ['width', 'height'],
  shadow: false,
  render: Minimap,
});

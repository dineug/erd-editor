import './Table';
import './Memo';
import './MinimapHandle';

import {
  defineComponent,
  html,
  svg,
  FunctionalComponent,
  beforeMount,
  watch,
} from '@vuerd/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { classMap } from 'lit-html/directives/class-map';
import { repeat } from 'lit-html/directives/repeat';
import { SIZE_MINIMAP_WIDTH, SIZE_MINIMAP_MARGIN } from '@/core/layout';
import { useContext } from '@/core/hooks/context.hook';
import { useRenderTrigger } from '@/core/hooks/renderTrigger.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { relationshipTpl } from '@/components/editor/Relationship.template';

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

  const getStyleMap = () => {
    const { width, height } = contextRef.value.store.canvasState;
    const ratio = SIZE_MINIMAP_WIDTH / width;
    const x = (-1 * width) / 2 + SIZE_MINIMAP_WIDTH / 2;
    const y = (-1 * height) / 2 + (height * ratio) / 2;
    const left = x - SIZE_MINIMAP_WIDTH - SIZE_MINIMAP_MARGIN + props.width;
    const top = y + SIZE_MINIMAP_MARGIN;
    return {
      transform: `scale(${ratio}, ${ratio})`,
      width: `${width}px`,
      height: `${height}px`,
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  const getShadowStyle = () => {
    const left = props.width - SIZE_MINIMAP_WIDTH - SIZE_MINIMAP_MARGIN;
    const top = SIZE_MINIMAP_MARGIN;
    return {
      width: `${SIZE_MINIMAP_WIDTH}px`,
      height: `${SIZE_MINIMAP_WIDTH}px`,
      left: `${left}px`,
      top: `${top}px`,
    };
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
      <div class="vuerd-minimap" style=${styleMap(getStyleMap())}>
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
            table =>
              html`
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
                relationship => {
                  const shape = relationshipTpl(relationship, 12);
                  return svg`
                  <g
                    class=${classMap({
                      'vuerd-relationship': true,
                      identification: relationship.identification,
                    })}
                  >
                    ${shape}
                  </g>
                `;
                }
              )}
              </svg>
          `
            : null}
        </div>
      </div>
      <vuerd-minimap-handle
        .width=${props.width}
        .height=${props.height}
      ></vuerd-minimap-handle>
    `;
  };
};

defineComponent('vuerd-minimap', {
  observedProps: ['width', 'height'],
  shadow: false,
  render: Minimap,
});

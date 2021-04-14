import {
  defineComponent,
  svg,
  FunctionalComponent,
  observable,
  closestElement,
  beforeMount,
} from '@dineug/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { fromEvent } from 'rxjs';
import { dragSelectTable } from '@/engine/command/table.cmd.helper';
import { dragSelectMemo } from '@/engine/command/memo.cmd.helper';
import { useContext } from '@/core/hooks/context.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import {
  getZoomViewport,
  getOverlapPosition,
  getAbsolutePosition,
} from '@/core/helper/dragSelect.helper';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-drag-select': DragSelectElement;
  }
}

export interface DragSelectProps {
  x: number;
  y: number;
}

export interface DragSelectElement extends DragSelectProps, HTMLElement {}

const DragSelect: FunctionalComponent<DragSelectProps, DragSelectElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  const state = observable({ width: 0, height: 0, top: 0, left: 0 });
  const { unmountedGroup } = useUnmounted();

  const onGlobalMouseup = () => {
    ctx.dispatchEvent(new CustomEvent('drag-select-end'));
  };

  beforeMount(() => {
    const {
      store,
      globalEvent: { mouseup$ },
    } = contextRef.value;
    const { canvasState } = store;
    const erd = closestElement('.vuerd-erd', ctx);
    if (!erd) return;

    unmountedGroup.push(
      mouseup$.subscribe(onGlobalMouseup),
      fromEvent<MouseEvent>(erd, 'mousemove').subscribe(event => {
        event.preventDefault();
        const rect = erd.getBoundingClientRect();
        const currentX = event.clientX - rect.x;
        const currentY = event.clientY - rect.y;
        const min = {
          x: props.x < currentX ? props.x : currentX,
          y: props.y < currentY ? props.y : currentY,
        };
        const max = {
          x: props.x > currentX ? props.x : currentX,
          y: props.y > currentY ? props.y : currentY,
        };

        state.left = min.x;
        state.width = max.x - min.x;
        if (state.width < 0) {
          state.width = 0;
        }

        state.top = min.y;
        state.height = max.y - min.y;
        if (state.height < 0) {
          state.height = 0;
        }

        const ghostMin = Object.assign({}, min);
        const ghostMax = Object.assign({}, max);

        ghostMin.x -= canvasState.scrollLeft;
        ghostMin.y -= canvasState.scrollTop;
        ghostMax.x -= canvasState.scrollLeft;
        ghostMax.y -= canvasState.scrollTop;

        const zoomViewportRect = getZoomViewport(
          canvasState.width,
          canvasState.height,
          canvasState.zoomLevel
        );

        const overlapPosition = getOverlapPosition(
          {
            ...ghostMin,
            w: ghostMax.x - ghostMin.x,
            h: ghostMax.y - ghostMin.y,
          },
          zoomViewportRect
        );

        if (!overlapPosition) return;

        const absolutePosition = getAbsolutePosition(
          overlapPosition,
          zoomViewportRect,
          canvasState.zoomLevel
        );

        ghostMin.x = absolutePosition.x1;
        ghostMin.y = absolutePosition.y1;
        ghostMax.x = absolutePosition.x2;
        ghostMax.y = absolutePosition.y2;

        store.dispatch(
          dragSelectTable(ghostMin, ghostMax),
          dragSelectMemo(ghostMin, ghostMax)
        );
      })
    );
  });

  return () => {
    return svg`
      <svg 
        class="vuerd-drag-select" 
        style=${styleMap({
          top: `${state.top}px`,
          left: `${state.left}px`,
          width: `${state.width}px`,
          height: `${state.height}px`,
        })}
      >
        <rect
          width=${state.width}
          height=${state.height}
          stroke-width="1"
          stroke-opacity="0.9"
          stroke-dasharray="3"
          fill-opacity="0.3"
        >
        </rect>
      </svg>    
    `;
  };
};

defineComponent('vuerd-drag-select', {
  observedProps: ['x', 'y'],
  shadow: false,
  render: DragSelect,
});

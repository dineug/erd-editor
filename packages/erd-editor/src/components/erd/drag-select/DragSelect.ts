import { FC, observable, onBeforeMount, Ref, svg } from '@dineug/r-html';
import { fromEvent } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import { dragSelectAction$ } from '@/engine/modules/editor/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import {
  getAbsolutePosition,
  getOverlapPosition,
  getZoomViewport,
} from '@/utils/dragSelect';
import { mouseup$ } from '@/utils/globalEventObservable';

import * as styles from './DragSelect.styles';

export type DragSelectProps = {
  x: number;
  y: number;
  root: Ref<HTMLDivElement>;
  onDragSelectEnd: () => void;
};

const DragSelect: FC<DragSelectProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const state = observable({ width: 0, height: 0, top: 0, left: 0 });
  const { addUnsubscribe } = useUnmounted();

  onBeforeMount(() => {
    const { store } = app.value;
    const { settings } = store.state;
    const $root = props.root.value;

    addUnsubscribe(
      mouseup$.subscribe(props.onDragSelectEnd),
      fromEvent<MouseEvent>($root, 'mousemove').subscribe(event => {
        event.preventDefault();
        const rect = $root.getBoundingClientRect();
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

        ghostMin.x -= settings.scrollLeft;
        ghostMin.y -= settings.scrollTop;
        ghostMax.x -= settings.scrollLeft;
        ghostMax.y -= settings.scrollTop;

        const zoomViewportRect = getZoomViewport(
          settings.width,
          settings.height,
          settings.zoomLevel
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
          settings.zoomLevel
        );

        ghostMin.x = absolutePosition.x1;
        ghostMin.y = absolutePosition.y1;
        ghostMax.x = absolutePosition.x2;
        ghostMax.y = absolutePosition.y2;

        store.dispatch(dragSelectAction$(ghostMin, ghostMax));
      })
    );
  });

  return () => svg`
    <svg
      class=${styles.dragSelect}
      style=${{
        top: `${state.top}px`,
        left: `${state.left}px`,
        width: `${state.width}px`,
        height: `${state.height}px`,
      }}
    >
      <rect
        width=${state.width}
        height=${state.height}
        stroke-width="1"
        stroke-opacity="1"
        stroke-dasharray="3"
        fill-opacity="0.3"
      >
      </rect>
    </svg>
  `;
};

export default DragSelect;

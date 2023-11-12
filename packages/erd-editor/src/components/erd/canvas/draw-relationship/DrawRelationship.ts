import { FC, onMounted, Ref, svg } from '@dineug/r-html';
import { fromEvent } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import { drawRelationshipAction } from '@/engine/modules/editor/atom.actions';
import { DrawRelationship as DrawRelationshipType } from '@/engine/modules/editor/state';
import { useUnmounted } from '@/hooks/useUnmounted';
import { getDraw } from '@/utils/draw-relationship/draw';

import * as styles from './DrawRelationship.styles';

export type DrawRelationshipProps = {
  root: Ref<HTMLDivElement>;
  draw: DrawRelationshipType;
};

const DrawRelationship: FC<DrawRelationshipProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();

  onMounted(() => {
    const $root = props.root.value;
    const { store } = app.value;

    addUnsubscribe(
      fromEvent<MouseEvent>($root, 'mousemove').subscribe(event => {
        event.preventDefault();
        const { x, y } = $root.getBoundingClientRect();

        store.dispatch(
          drawRelationshipAction({
            x: event.clientX - x,
            y: event.clientY - y,
          })
        );
      })
    );
  });

  return () => {
    const { store } = app.value;
    const {
      settings: { width, height },
    } = store.state;

    const { path, line } = getDraw(store.state, props.draw);

    return svg`
      <svg
        class=${styles.root}
        style=${{
          width: `${width}px`,
          height: `${height}px`,
          'min-width': `${width}px`,
          'min-height': `${height}px`,
        }}
      >
        <g>
          <path
            d=${path.path.d()}
            stroke-dasharray="10"
            stroke-width="3"
            fill="transparent"
          ></path>
          <line
            x1=${path.line.start.x1} y1=${path.line.start.y1}
            x2=${path.line.start.x2} y2=${path.line.start.y2}
            stroke-width="3"
          ></line>
          <line
            x1=${line.start.base.x1} y1=${line.start.base.y1}
            x2=${line.start.base.x2} y2=${line.start.base.y2}
            stroke-width="3"
          ></line>
          <line
            x1=${line.start.base2.x1} y1=${line.start.base2.y1}
            x2=${line.start.base2.x2} y2=${line.start.base2.y2}
            stroke-width="3"
          ></line>
          <line
            x1=${line.start.center2.x1} y1=${line.start.center2.y1}
            x2=${line.start.center2.x2} y2=${line.start.center2.y2}
            stroke-width="3"
          ></line>
        </g>
      </svg>
    `;
  };
};

export default DrawRelationship;

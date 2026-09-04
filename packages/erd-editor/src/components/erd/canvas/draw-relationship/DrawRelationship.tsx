/** @jsxHost konva */

import { FC, onMounted, Ref } from '@dineug/r-html';
import { fromEvent } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import { segment } from '@/components/erd/canvas/relationship-group/relationship/Relationship.template';
import { useThemeContext } from '@/components/themeContext';
import { RELATIONSHIP_STROKE_WIDTH } from '@/constants/layout';
import { drawRelationshipAction } from '@/engine/modules/editor/atom.actions';
import { DrawRelationship as DrawRelationshipType } from '@/engine/modules/editor/state';
import { useUnmounted } from '@/hooks/useUnmounted';
import { getDraw } from '@/utils/draw-relationship/draw';

/** Ten on, ten off: what the svg preview spelt as a single dasharray of 10. */
const PREVIEW_DASH = [10, 10];

const DECORATION = 'draw-relationship-decoration';

export type DrawRelationshipProps = {
  root: Ref<HTMLDivElement>;
  draw: DrawRelationshipType;
};

const DrawRelationship: FC<DrawRelationshipProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
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
    const { path, line } = getDraw(store.state, props.draw);
    const stroke = themeRef.value.keyFK;
    const decorations = [
      path.line.start,
      line.start.base,
      line.start.base2,
      line.start.center2,
    ];

    return (
      <k-group
        id="draw-relationship"
        name="draw-relationship"
        kind="draw-relationship"
        listening={false}
      >
        <k-path
          name="draw-relationship-preview"
          kind="draw-relationship-preview"
          data={path.path.d()}
          dash={PREVIEW_DASH}
          stroke={stroke}
          strokeWidth={RELATIONSHIP_STROKE_WIDTH}
        />
        {decorations.map(decoration => (
          <k-line
            name={DECORATION}
            kind={DECORATION}
            points={segment(decoration)}
            stroke={stroke}
            strokeWidth={RELATIONSHIP_STROKE_WIDTH}
          />
        ))}
      </k-group>
    );
  };
};

export default DrawRelationship;

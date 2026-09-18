/** @jsxHost konva */

import { FC, observable, onMounted, Ref } from '@dineug/r-html';
import { type Stage, stages } from 'konva/lib/Stage';
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
  // Hidden until a pointer places the end, which until then is the placeholder
  // the draw was armed with: the scene origin, where no pointer ever was.
  const state = observable({ placed: false });

  /**
   * Places the end at the press that mounted the preview. A draw started off
   * the canvas has no pointer the stage still holds, and waits for a move.
   */
  const placeAtPress = (stage: Stage) => {
    // Not getPointerPosition, which warns without a pointer and falls back to
    // the last one that left the stage, a point no longer under anything.
    const [pointer] = stage.getPointersPositions();
    if (!pointer) return;

    const container = stage.container().getBoundingClientRect();
    const root = props.root.value.getBoundingClientRect();

    state.placed = true;
    app.value.store.dispatchSync(
      drawRelationshipAction({
        x: pointer.x + container.x - root.x,
        y: pointer.y + container.y - root.y,
      })
    );
  };

  onMounted(() => {
    const $root = props.root.value;
    const { store } = app.value;

    // The group reaches its stage only at the commit after this mount, while the
    // host already resolves the container it commits into, which names the stage.
    const stage = stages.find(candidate => candidate.container() === ctx.host);
    stage && placeAtPress(stage);

    addUnsubscribe(
      fromEvent<MouseEvent>($root, 'mousemove').subscribe(event => {
        event.preventDefault();
        const { x, y } = $root.getBoundingClientRect();

        state.placed = true;
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
        visible={state.placed}
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

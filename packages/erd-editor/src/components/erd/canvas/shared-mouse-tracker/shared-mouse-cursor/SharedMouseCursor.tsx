/** @jsxHost konva */

import { FC, observable, onMounted } from '@dineug/r-html';

import {
  ICON_VIEW_SIZE,
  SCENE_FONT_FAMILY,
} from '@/components/erd/canvas/sceneTokens';
import { getIcon, ICON_STROKE_WIDTH } from '@/components/primitives/icon/icons';
import { SharedMouseTracker } from '@/engine/modules/editor/state';
import { useUnmounted } from '@/hooks/useUnmounted';
import { animationFrames$ } from '@/utils/globalEventObservable';
import { toSharedColor } from '@/utils/sharedColor';

const ICON_SIZE = 16;
const MAX_WIDTH = 100;
const NICKNAME_WIDTH = MAX_WIDTH - ICON_SIZE;
const FONT_SIZE = 12;

const ICON_SCALE = ICON_SIZE / ICON_VIEW_SIZE;

/** The outline of the pointer, taken from the icon set the DOM cursor drew. */
function pointerPathData(): string[] {
  const icon = getIcon('mouse-pointer-2');
  if (!icon) return [];

  return icon.node
    .filter(([tag]) => tag === 'path')
    .map(([, attrs]) => String(attrs.d ?? ''));
}

const POINTER_PATH_DATA = pointerPathData();

export type SharedMouseCursorProps = {
  tracker: SharedMouseTracker;
};

/**
 * One peer's pointer and nickname, eased toward the position they last shared.
 * The colour identifies the editor rather than the theme, so it comes from the
 * shared palette instead of a resolved token.
 */
const SharedMouseCursor: FC<SharedMouseCursorProps> = (props, ctx) => {
  const state = observable({
    x: props.tracker.x,
    y: props.tracker.y,
  });
  const { addUnsubscribe } = useUnmounted();

  onMounted(() => {
    addUnsubscribe(
      animationFrames$.subscribe(() => {
        const { tracker } = props;
        state.x += (tracker.x - state.x) * 0.05;
        state.y += (tracker.y - state.y) * 0.05;
      })
    );
  });

  return () => {
    const {
      tracker: { id, nickname },
    } = props;
    const color = toSharedColor(id);

    return (
      <k-group
        id={`shared-mouse-cursor-${id}`}
        name="shared-mouse-cursor"
        kind="shared-mouse-cursor"
        x={state.x}
        y={state.y}
        listening={false}
      >
        <k-group
          name="shared-mouse-cursor-icon"
          kind="shared-mouse-cursor-icon"
          scaleX={ICON_SCALE}
          scaleY={ICON_SCALE}
        >
          {POINTER_PATH_DATA.map(data => (
            <k-path
              name="shared-mouse-cursor-pointer"
              kind="shared-mouse-cursor-pointer"
              data={data}
              stroke={color}
              strokeWidth={ICON_STROKE_WIDTH}
              lineCap="round"
              lineJoin="round"
            />
          ))}
        </k-group>
        <k-text
          name="shared-mouse-cursor-nickname"
          kind="shared-mouse-cursor-nickname"
          text={nickname}
          x={ICON_SIZE}
          width={NICKNAME_WIDTH}
          height={ICON_SIZE}
          verticalAlign="middle"
          wrap="none"
          ellipsis={true}
          fill={color}
          fontFamily={SCENE_FONT_FAMILY}
          fontSize={FONT_SIZE}
        />
      </k-group>
    );
  };
};

export default SharedMouseCursor;

import {
  createRef,
  DOMTemplateLiterals,
  FC,
  observable,
  onMounted,
  onUpdated,
  ref,
} from '@dineug/r-html';
import { isNil } from 'es-toolkit';

import { fitMenu } from '@/components/primitives/context-menu/context-menu-content/fitMenu';

import * as styles from './ContextMenuContent.styles';

export type ContextMenuContentProps = {
  id: string;
  x: number;
  y: number;
  // Moves the menu into the window once it has a size. The row display menu
  // anchors itself by a transform and is left without it.
  fit?: boolean;
  // The x a fitted submenu ends at when it opens to the left of its row.
  flipX?: number;
  children?: DOMTemplateLiterals;
};

const ContextMenuContent: FC<ContextMenuContentProps> = (props, ctx) => {
  const $content = createRef<HTMLDivElement>();
  const state = observable({ dx: 0, dy: 0 });
  let fitted = '';
  let pointerStill = true;

  /*
   * Measured off the rendered rect, so an offset or transformed containing
   * block still ends inside the window. Once per position and size, so neither
   * the pass its own write schedules nor a box that ignores the move can loop.
   */
  const fit = () => {
    if (!props.fit) return;

    const rect = $content.value.getBoundingClientRect();
    const measured = [props.x, props.y, props.flipX, rect.width, rect.height];
    if (measured.join() === fitted) return;
    fitted = measured.join();

    const offsetX = Math.round(rect.left - props.x - state.dx);
    const offsetY = Math.round(rect.top - props.y - state.dy);
    const { dx, dy } = fitMenu(
      {
        left: props.x + offsetX,
        top: props.y + offsetY,
        width: rect.width,
        height: rect.height,
      },
      { width: window.innerWidth, height: window.innerHeight },
      isNil(props.flipX) ? undefined : props.flipX + offsetX
    );

    if (state.dx !== dx) state.dx = dx;
    if (state.dy !== dy) state.dy = dy;
  };

  // A menu cut to the window keeps the wheel that scrolls it, which the canvas
  // below would otherwise cancel for a pan.
  const handleWheel = (event: WheelEvent) => {
    const $el = $content.value;
    if ($el.scrollHeight > $el.clientHeight) event.stopPropagation();
  };

  /*
   * Fitted back on both axes, a menu stands over the pointer that opened it, and
   * the row landing there neither opens nor runs until that pointer moves.
   * Captured, since a row's mouseenter never bubbles to its menu.
   */
  const holdStillPointer = (event: MouseEvent) => {
    if (!pointerStill) return;

    if (event.clientX !== props.x || event.clientY !== props.y) {
      pointerStill = false;
    } else if (state.dx < 0 && state.dy < 0) {
      event.stopPropagation();
    }
  };

  onMounted(() => {
    for (const type of ['mouseenter', 'mousemove', 'click'] as const) {
      $content.value.addEventListener(type, holdStillPointer, true);
    }
    fit();
  });
  onUpdated(fit);

  return () => (
    <div
      use:ref={ref($content)}
      class={['context-menu-content', styles.content]}
      style={{
        left: `${props.x + state.dx}px`,
        top: `${props.y + state.dy}px`,
      }}
      data-id={props.id}
      on:wheel={handleWheel}
    >
      {props.children}
    </div>
  );
};

export default ContextMenuContent;

import { observable } from '@vuerd/lit-observable';

import { isMouseEvent } from '@/core/helper/dom.helper';
import { getViewport } from '@/core/helper/dragSelect.helper';
import { DragMove } from '@/core/helper/event.helper';
import { useContext } from '@/core/hooks/context.hook';
import { SIZE_MINIMAP_WIDTH } from '@/core/layout';
import { movementCanvas } from '@/engine/command/canvas.cmd.helper';

export const DirectionName = {
  left: 'left',
  right: 'right',
  top: 'top',
  bottom: 'bottom',
} as const;
export type DirectionName = (typeof DirectionName)[keyof typeof DirectionName];

export function useMinimapScroll(ctx: HTMLElement) {
  const contextRef = useContext(ctx);
  const state = observable({
    selected: false,
  });

  let clientX = 0;
  let clientY = 0;

  const getRatio = () => {
    const { store } = contextRef.value;
    return SIZE_MINIMAP_WIDTH / store.canvasState.width;
  };

  const absoluteMovement = (movement: number) => {
    const ratio = getRatio();
    return -1 * (movement / ratio);
  };

  const getMovementX = ({ movementX, x }: DragMove) => {
    const { store } = contextRef.value;
    const viewport = getViewport(store);
    const scrollLeft =
      store.canvasState.scrollLeft + absoluteMovement(movementX);
    const min = viewport.width - store.canvasState.width;
    const max = 0;
    const direction = movementX < 0 ? DirectionName.left : DirectionName.right;
    let change = false;

    switch (direction) {
      case DirectionName.left:
        if (scrollLeft < max && x < clientX) {
          clientX += movementX;
          change = true;
        }
        break;
      case DirectionName.right:
        if (scrollLeft > min && x > clientX) {
          clientX += movementX;
          change = true;
        }
        break;
    }

    return change ? movementX : 0;
  };

  const getMovementY = ({ movementY, y }: DragMove) => {
    const { store } = contextRef.value;
    const scrollTop = store.canvasState.scrollTop + absoluteMovement(movementY);
    const min = store.editorState.viewport.height - store.canvasState.height;
    const max = 0;
    const direction = movementY < 0 ? DirectionName.top : DirectionName.bottom;
    let change = false;

    switch (direction) {
      case DirectionName.top:
        if (scrollTop < max && y < clientY) {
          clientY += movementY;
          change = true;
        }
        break;
      case DirectionName.bottom:
        if (scrollTop > min && y > clientY) {
          clientY += movementY;
          change = true;
        }
        break;
    }

    return change ? movementY : 0;
  };

  const handleScroll = (dragMove: DragMove) => {
    const { event } = dragMove;
    event.type === 'mousemove' && event.preventDefault();
    const movementX = getMovementX(dragMove);
    const movementY = getMovementY(dragMove);

    if (movementX === 0 && movementY === 0) {
      return;
    }

    const { store } = contextRef.value;
    store.dispatch(
      movementCanvas(absoluteMovement(movementX), absoluteMovement(movementY))
    );
  };

  const onScrollStart = (event: MouseEvent | TouchEvent) => {
    const {
      globalEvent: { drag$ },
    } = contextRef.value;
    state.selected = true;

    clientX = isMouseEvent(event) ? event.clientX : event.touches[0].clientX;
    clientY = isMouseEvent(event) ? event.clientY : event.touches[0].clientY;

    drag$.subscribe({
      next: handleScroll,
      complete: () => {
        state.selected = false;
      },
    });
  };

  return {
    state,
    onScrollStart,
  };
}

import { observable } from '@vuerd/lit-observable';

import { getViewport } from '@/core/helper/dragSelect.helper';
import { DragMove } from '@/core/helper/event.helper';
import { useContext } from '@/core/hooks/context.hook';
import { movementCanvas } from '@/engine/command/canvas.cmd.helper';

import { VirtualScrollElement } from './VirtualScroll';

export const DirectionName = {
  left: 'left',
  right: 'right',
  top: 'top',
  bottom: 'bottom',
} as const;
export type DirectionName = (typeof DirectionName)[keyof typeof DirectionName];

export function useVirtualScroll(ctx: VirtualScrollElement) {
  const contextRef = useContext(ctx);
  const state = observable({
    selected: null as null | 'horizontal' | 'vertical',
  });

  let clientX = 0;
  let clientY = 0;

  const getWidthRatio = () => {
    const { store } = contextRef.value;
    const viewport = getViewport(store);
    return viewport.width / store.canvasState.width;
  };

  const getHeightRatio = () => {
    const { store } = contextRef.value;
    const viewport = getViewport(store);
    return viewport.height / store.canvasState.height;
  };

  const absoluteMovement = (movement: number, ratio: number) => {
    return -1 * (movement / ratio);
  };

  const getMovementX = ({ movementX, x }: DragMove) => {
    const { store } = contextRef.value;
    const viewport = getViewport(store);
    const scrollLeft =
      store.canvasState.scrollLeft +
      absoluteMovement(movementX, getWidthRatio());
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
    const scrollTop =
      store.canvasState.scrollTop +
      absoluteMovement(movementY, getHeightRatio());
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
    const isVertical = state.selected === 'vertical';
    const isHorizontal = state.selected === 'horizontal';
    const movementX = getMovementX(dragMove);
    const movementY = getMovementY(dragMove);
    const { store } = contextRef.value;

    if (isVertical && movementY !== 0) {
      store.dispatch(
        movementCanvas(0, absoluteMovement(movementY, getHeightRatio()))
      );
    } else if (isHorizontal && movementX !== 0) {
      store.dispatch(
        movementCanvas(absoluteMovement(movementX, getWidthRatio()), 0)
      );
    }
  };

  const onScrollLeftStart = (event: MouseEvent) => {
    const {
      globalEvent: { drag$ },
    } = contextRef.value;
    state.selected = 'horizontal';
    clientX = event.clientX;

    drag$.subscribe({
      next: handleScroll,
      complete: () => {
        state.selected = null;
      },
    });
  };

  const onScrollTopStart = (event: MouseEvent) => {
    const {
      globalEvent: { drag$ },
    } = contextRef.value;
    state.selected = 'vertical';
    clientY = event.clientY;

    drag$.subscribe({
      next: handleScroll,
      complete: () => {
        state.selected = null;
      },
    });
  };

  return {
    state,
    onScrollLeftStart,
    onScrollTopStart,
    getWidthRatio,
    getHeightRatio,
  };
}

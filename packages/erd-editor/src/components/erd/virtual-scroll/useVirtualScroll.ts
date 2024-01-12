import { observable } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { streamScrollToAction } from '@/engine/modules/settings/atom.actions';
import { Ctx } from '@/internal-types';
import { DirectionName } from '@/utils/draw-relationship';
import { drag$, DragMove } from '@/utils/globalEventObservable';

export function useVirtualScroll(ctx: Ctx) {
  const app = useAppContext(ctx);
  const state = observable({
    selected: null as null | 'horizontal' | 'vertical',
  });

  let clientX = 0;
  let clientY = 0;

  const getWidthRatio = () => {
    const { store } = app.value;
    const {
      editor: { viewport },
      settings: { width },
    } = store.state;
    return viewport.width / width;
  };

  const getHeightRatio = () => {
    const { store } = app.value;
    const {
      editor: { viewport },
      settings: { height },
    } = store.state;
    return viewport.height / height;
  };

  const absoluteMovement = (movement: number, ratio: number) => {
    return -1 * (movement / ratio);
  };

  const getMovementX = ({ movementX, x }: DragMove) => {
    const { store } = app.value;
    const {
      settings,
      editor: { viewport },
    } = store.state;
    const scrollLeft =
      settings.scrollLeft + absoluteMovement(movementX, getWidthRatio());
    const min = viewport.width - settings.width;
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
    const { store } = app.value;
    const {
      settings,
      editor: { viewport },
    } = store.state;
    const scrollTop =
      settings.scrollTop + absoluteMovement(movementY, getHeightRatio());
    const min = viewport.height - settings.height;
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
    const { store } = app.value;

    if (isVertical && movementY !== 0) {
      store.dispatch(
        streamScrollToAction({
          movementX: 0,
          movementY: absoluteMovement(movementY, getHeightRatio()),
        })
      );
    } else if (isHorizontal && movementX !== 0) {
      store.dispatch(
        streamScrollToAction({
          movementX: absoluteMovement(movementX, getWidthRatio()),
          movementY: 0,
        })
      );
    }
  };

  const onScrollLeftStart = (event: MouseEvent) => {
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

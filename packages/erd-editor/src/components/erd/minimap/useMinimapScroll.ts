import { observable } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { MINIMAP_SIZE } from '@/constants/layout';
import { streamScrollToAction } from '@/engine/modules/settings/atom.actions';
import { Ctx } from '@/internal-types';
import { isMouseEvent } from '@/utils/domEvent';
import { DirectionName } from '@/utils/draw-relationship';
import { drag$, DragMove } from '@/utils/globalEventObservable';

export function useMinimapScroll(ctx: Ctx) {
  const app = useAppContext(ctx);
  const state = observable({
    selected: false,
  });

  let clientX = 0;
  let clientY = 0;

  const getRatio = () => {
    const { store } = app.value;
    const {
      settings: { width },
    } = store.state;
    return MINIMAP_SIZE / width;
  };

  const absoluteMovement = (movement: number) => {
    const ratio = getRatio();
    return -1 * (movement / ratio);
  };

  const getMovementX = ({ movementX, x }: DragMove) => {
    const { store } = app.value;
    const {
      settings,
      editor: { viewport },
    } = store.state;
    const scrollLeft = settings.scrollLeft + absoluteMovement(movementX);
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
    const scrollTop = settings.scrollTop + absoluteMovement(movementY);
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
    const movementX = getMovementX(dragMove);
    const movementY = getMovementY(dragMove);

    if (movementX === 0 && movementY === 0) {
      return;
    }

    const { store } = app.value;
    store.dispatch(
      streamScrollToAction({
        movementX: absoluteMovement(movementX),
        movementY: absoluteMovement(movementY),
      })
    );
  };

  const onScrollStart = (event: MouseEvent | TouchEvent) => {
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

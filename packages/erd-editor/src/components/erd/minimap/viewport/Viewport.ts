import { FC, html, observable } from '@dineug/r-html';

import { useAppContext } from '@/components/context';
import { MINIMAP_MARGIN, MINIMAP_SIZE } from '@/constants/layout';
import { streamScrollToAction } from '@/engine/modules/settings/atom.actions';
import { drag$, DragMove } from '@/utils/globalEventObservable';

import * as styles from './Viewport.styles';

export type ViewportProps = {};

const Viewport: FC<ViewportProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const state = observable({
    selected: false,
  });

  const getRatio = () => {
    const { store } = app.value;
    const {
      settings: { width },
    } = store.state;
    return MINIMAP_SIZE / width;
  };

  const styleMap = () => {
    const { store } = app.value;
    const {
      settings: { scrollTop, scrollLeft },
      editor: { viewport },
    } = store.state;
    const ratio = getRatio();
    const x = scrollLeft * ratio;
    const y = scrollTop * ratio;
    const left = viewport.width - MINIMAP_SIZE - MINIMAP_MARGIN - x;
    const top = MINIMAP_MARGIN - y;
    const width = viewport.width * ratio;
    const height = viewport.height * ratio;

    return {
      width: `${width}px`,
      height: `${height}px`,
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  const handleMove = ({ event, movementX, movementY }: DragMove) => {
    event.type === 'mousemove' && event.preventDefault();
    const { store } = app.value;
    const ratio = getRatio();

    store.dispatch(
      streamScrollToAction({
        movementX: -1 * (movementX / ratio),
        movementY: -1 * (movementY / ratio),
      })
    );
  };

  const handleMoveStart = () => {
    state.selected = true;
    drag$.subscribe({
      next: handleMove,
      complete: () => {
        state.selected = false;
      },
    });
  };

  return () => html`
    <div
      class=${[styles.viewport, { selected: state.selected }]}
      style=${styleMap()}
      @mousedown=${handleMoveStart}
      @touchstart=${handleMoveStart}
    ></div>
  `;
};

export default Viewport;

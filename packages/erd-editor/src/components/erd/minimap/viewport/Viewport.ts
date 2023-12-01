import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useMinimapScroll } from '@/components/erd/minimap/useMinimapScroll';
import { MINIMAP_MARGIN, MINIMAP_SIZE } from '@/constants/layout';

import * as styles from './Viewport.styles';

export type ViewportProps = {
  selected: boolean;
};

const Viewport: FC<ViewportProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { state, onScrollStart } = useMinimapScroll(ctx);

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

  return () => html`
    <div
      class=${[
        'minimap-viewport',
        styles.viewport,
        { selected: state.selected || props.selected },
      ]}
      style=${styleMap()}
      data-focus-border
      @mousedown=${onScrollStart}
      @touchstart=${onScrollStart}
    ></div>
  `;
};

export default Viewport;

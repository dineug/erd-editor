import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  getMinimapHandleRect,
  getMinimapLayout,
  getViewTransform,
} from '@/components/erd/minimap/minimapGeometry';
import { useMinimapScroll } from '@/components/erd/minimap/useMinimapScroll';
import { MINIMAP_MARGIN } from '@/constants/layout';

import * as styles from './Viewport.styles';

export type ViewportProps = {
  selected: boolean;
};

const Viewport: FC<ViewportProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { state, onScrollStart } = useMinimapScroll(ctx);

  /**
   * The screen's own footprint on the map, drawn at the map's ratio and
   * trimmed to the box. The zoom lives in the size here and in how much of the
   * map the screen takes, so zooming out grows this and the map together.
   */
  const styleMap = () => {
    const { store } = app.value;
    const layout = getMinimapLayout(store.state);
    const rect = getMinimapHandleRect(layout, getViewTransform(store.state));
    const { box, offset } = layout;

    // The thumbnail box is anchored to the right and centred in the square, so
    // this one is measured from the square's right edge back over the box.
    const top = MINIMAP_MARGIN + offset.y + rect.y;
    const right = MINIMAP_MARGIN + offset.x + (box.width - rect.x - rect.width);

    return {
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      right: `${right}px`,
      top: `${top}px`,
    };
  };

  return () => (
    <div
      class={[
        'minimap-viewport',
        styles.viewport,
        { selected: state.selected || props.selected },
      ]}
      style={styleMap()}
      data-focus-border
      on:mousedown={onScrollStart}
      on:touchstart={onScrollStart}
    ></div>
  );
};

export default Viewport;

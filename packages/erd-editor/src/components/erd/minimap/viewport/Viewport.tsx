import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { getMinimapHandleRect } from '@/components/erd/minimap/minimapGeometry';
import { useMinimapScroll } from '@/components/erd/minimap/useMinimapScroll';
import { MINIMAP_MARGIN, MINIMAP_SIZE } from '@/constants/layout';

import * as styles from './Viewport.styles';

export type ViewportProps = {
  selected: boolean;
};

const Viewport: FC<ViewportProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { state, onScrollStart } = useMinimapScroll(ctx);

  /**
   * The screen's own footprint on the canvas, drawn at the minimap's fixed
   * ratio and trimmed to the map. The zoom lives in the size here rather than
   * in the thumbnail, so zooming out grows this instead of shrinking the map.
   */
  const styleMap = () => {
    const { store } = app.value;
    const {
      settings: { width, height, scrollLeft, scrollTop, zoomLevel },
      editor: { viewport },
    } = store.state;

    const rect = getMinimapHandleRect({
      width,
      height,
      scrollLeft,
      scrollTop,
      zoomLevel,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    });

    // The minimap box is anchored to the right, so the offset that positions
    // this one is measured from its right edge back over the rectangle.
    const top = MINIMAP_MARGIN + rect.y;
    const right = MINIMAP_MARGIN + MINIMAP_SIZE - rect.x - rect.width;

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

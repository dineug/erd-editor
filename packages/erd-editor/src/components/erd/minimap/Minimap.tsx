import { createRef, FC, onMounted, ref } from '@dineug/r-html';
import { Stage } from 'konva/lib/Stage';

import { useAppContext } from '@/components/appContext';
import * as canvasStyle from '@/components/erd/canvas/Canvas.styles';
import {
  fromMinimapPoint,
  getMinimapLayout,
  getScrollToCenter,
  getViewTransform,
  type MinimapLayout,
} from '@/components/erd/minimap/minimapGeometry';
import { renderMinimapScene } from '@/components/erd/minimap/MinimapScene';
import Viewport from '@/components/erd/minimap/viewport/Viewport';
import { MINIMAP_MARGIN, MINIMAP_SIZE } from '@/constants/layout';
import { scrollToAction } from '@/engine/modules/settings/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { MINIMAP_STAGE_NAME, renderKonva } from '@/konva/host';
import { registerStage, unregisterStage } from '@/konva/testHandle';
import { isMouseEvent } from '@/utils/domEvent';

import * as styles from './Minimap.styles';
import { useMinimapScroll } from './useMinimapScroll';

const BORDER = 1;

export type MinimapProps = {};

const Minimap: FC<MinimapProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const minimap = createRef<HTMLDivElement>();
  const canvas = createRef<HTMLDivElement>();
  const { state, onScrollStart } = useMinimapScroll(ctx);
  const { addUnsubscribe } = useUnmounted();
  let stage: Stage | null = null;

  const getLayout = () => getMinimapLayout(app.value.store.state);

  /**
   * The thumbnail's own box, centred in the minimap square along its shorter
   * side. The map is a rect of the travel, so the box follows its aspect, and
   * the frame around it stays the square it always was.
   */
  const styleMap = ({ box, offset }: MinimapLayout) => ({
    width: `${box.width}px`,
    height: `${box.height}px`,
    right: `${MINIMAP_MARGIN + offset.x}px`,
    top: `${MINIMAP_MARGIN + offset.y}px`,
  });

  const sceneStyleMap = ({ box }: MinimapLayout) => ({
    width: `${box.width}px`,
    height: `${box.height}px`,
  });

  const borderStyleMap = () => {
    const margin = MINIMAP_MARGIN - BORDER;
    return {
      width: `${MINIMAP_SIZE}px`,
      height: `${MINIMAP_SIZE}px`,
      right: `${margin}px`,
      top: `${margin}px`,
    };
  };

  /**
   * Keeps the Stage the size of the box. Read off the layout the render just
   * took rather than watched on the settings, because a table moved far away
   * changes the box with no setting changing at all.
   */
  const fitStage = ({ box }: MinimapLayout) => {
    if (!stage) return;
    if (stage.width() === box.width && stage.height() === box.height) return;
    stage.size(box);
  };

  /**
   * Centres the screen on the pressed point, wherever that is. A press at the
   * map's edge asks for a screen half outside the travel and gets it: a pan
   * goes anywhere, and the map grows to hold the screen where the press sent it.
   */
  const handleMove = (event: MouseEvent | TouchEvent) => {
    // A tap is followed by a compatibility mouse press at the same pixel, and
    // the map has moved by then, so the second one centres somewhere else.
    if (!isMouseEvent(event)) event.preventDefault();

    const { store } = app.value;
    const layout = getLayout();
    const $minimap = minimap.value;
    const rect = $minimap.getBoundingClientRect();
    const clientX = isMouseEvent(event)
      ? event.clientX
      : event.touches[0].clientX;
    const clientY = isMouseEvent(event)
      ? event.clientY
      : event.touches[0].clientY;

    const center = fromMinimapPoint(layout, {
      x: clientX - rect.x,
      y: clientY - rect.y,
    });
    const origin = getScrollToCenter(getViewTransform(store.state), center);

    // Landed before the drag takes hold of the view, so the map the drag then
    // holds is one laid out around the screen the press sent it to, and the
    // handle is whole on it for as long as the drag lasts.
    store.dispatchSync(
      scrollToAction({ originX: origin.x, originY: origin.y })
    );

    onScrollStart(event);
  };

  onMounted(() => {
    const { box } = getLayout();

    const $stage = new Stage({
      container: canvas.value,
      name: MINIMAP_STAGE_NAME,
      width: box.width,
      height: box.height,
    });

    stage = $stage;
    registerStage(MINIMAP_STAGE_NAME, $stage);
    renderMinimapScene($stage);

    addUnsubscribe(() => {
      stage = null;
      unregisterStage(MINIMAP_STAGE_NAME, $stage);
      renderKonva($stage, null);
      $stage.destroy();
    });
  });

  if (import.meta.hot) {
    // The scene is the root of an imperative render rather than a value in this
    // template, so r-html's own boundary cannot swap it. Rendering the root
    // again here is what makes an edit to the scene show without a reload.
    import.meta.hot.accept(
      '@/components/erd/minimap/MinimapScene',
      (mod: any) => {
        if (!stage || !mod) return;
        mod.renderMinimapScene(stage);
      }
    );
  }

  return () => {
    const layout = getLayout();
    fitStage(layout);

    // The frame comes first so the thumbnail, centred inside it, is painted
    // over its boundary colour rather than under it.
    return (
      <>
        <div class={styles.border} style={borderStyleMap()}></div>
        <div
          class={['minimap', styles.minimap]}
          style={styleMap(layout)}
          use:ref={ref(minimap)}
          on:mousedown={handleMove}
          on:touchstart={handleMove}
        >
          <div
            class={canvasStyle.root}
            style={sceneStyleMap(layout)}
            use:ref={ref(canvas)}
          ></div>
        </div>
        <Viewport selected={state.selected} />
      </>
    );
  };
};

export default Minimap;

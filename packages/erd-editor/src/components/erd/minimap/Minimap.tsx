import { createRef, FC, onMounted, ref, watch } from '@dineug/r-html';
import { Stage } from 'konva/lib/Stage';

import { useAppContext } from '@/components/appContext';
import * as canvasStyle from '@/components/erd/canvas/Canvas.styles';
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

  const getRatio = () => {
    const { store } = app.value;
    const {
      settings: { width },
    } = store.state;
    return MINIMAP_SIZE / width;
  };

  /**
   * The thumbnail's own box. The container used to be the canvas at full size
   * with a scale on it, and the box below is what that scale drew, which is
   * what getBoundingClientRect answered then and answers now.
   */
  const getSize = () => {
    const { store } = app.value;
    const {
      settings: { width, height },
    } = store.state;
    const ratio = getRatio();

    return { width: width * ratio, height: height * ratio };
  };

  const styleMap = () => {
    const { width, height } = getSize();

    return {
      width: `${width}px`,
      height: `${height}px`,
      right: `${MINIMAP_MARGIN}px`,
      top: `${MINIMAP_MARGIN}px`,
    };
  };

  const sceneStyleMap = () => {
    const { width, height } = getSize();

    return {
      width: `${width}px`,
      height: `${height}px`,
    };
  };

  const borderStyleMap = () => {
    const margin = MINIMAP_MARGIN - BORDER;
    return {
      width: `${MINIMAP_SIZE}px`,
      height: `${MINIMAP_SIZE}px`,
      right: `${margin}px`,
      top: `${margin}px`,
    };
  };

  const handleMove = (event: MouseEvent | TouchEvent) => {
    const { store } = app.value;
    const {
      editor: { viewport },
    } = store.state;
    const ratio = getRatio();
    const $minimap = minimap.value;
    const rect = $minimap.getBoundingClientRect();
    const clientX = isMouseEvent(event)
      ? event.clientX
      : event.touches[0].clientX;
    const clientY = isMouseEvent(event)
      ? event.clientY
      : event.touches[0].clientY;

    const x = clientX - rect.x;
    const y = clientY - rect.y;
    const absoluteX = x / ratio;
    const absoluteY = y / ratio;
    const scrollLeft = absoluteX - viewport.width / 2;
    const scrollTop = absoluteY - viewport.height / 2;

    store.dispatch(
      scrollToAction({
        scrollLeft: -1 * scrollLeft,
        scrollTop: -1 * scrollTop,
      })
    );

    onScrollStart(event);
  };

  onMounted(() => {
    const { store } = app.value;
    const { settings } = store.state;
    const size = getSize();

    const $stage = new Stage({
      container: canvas.value,
      name: MINIMAP_STAGE_NAME,
      width: size.width,
      height: size.height,
    });

    stage = $stage;
    registerStage(MINIMAP_STAGE_NAME, $stage);
    renderMinimapScene($stage);

    addUnsubscribe(
      watch(settings).subscribe(propName => {
        if (propName !== 'width' && propName !== 'height') return;
        $stage.size(getSize());
      }),
      () => {
        stage = null;
        unregisterStage(MINIMAP_STAGE_NAME, $stage);
        renderKonva($stage, null);
        $stage.destroy();
      }
    );
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

  return () => (
    <>
      <div
        class={['minimap', styles.minimap]}
        style={styleMap()}
        use:ref={ref(minimap)}
        on:mousedown={handleMove}
        on:touchstart={handleMove}
      >
        <div
          class={canvasStyle.root}
          style={sceneStyleMap()}
          use:ref={ref(canvas)}
        ></div>
      </div>
      <div class={styles.border} style={borderStyleMap()}></div>
      <Viewport selected={state.selected} />
    </>
  );
};

export default Minimap;

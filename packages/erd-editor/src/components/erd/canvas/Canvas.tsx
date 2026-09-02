import { FC, onMounted, Ref, ref, watch } from '@dineug/r-html';
import { Stage } from 'konva/lib/Stage';

import { useAppContext } from '@/components/appContext';
import { renderCanvasScene } from '@/components/erd/canvas/CanvasScene';
import EditOverlay from '@/components/erd/canvas/EditOverlay';
import { trackSceneHits } from '@/components/erd/hitTest';
import { useUnmounted } from '@/hooks/useUnmounted';
import { renderKonva } from '@/konva/host';
import { registerStage, unregisterStage } from '@/konva/testHandle';

import * as styles from './Canvas.styles';

/** The registry key a spec reads the main canvas Stage back from. */
const STAGE_NAME = 'canvas';

export type CanvasProps = {
  root: Ref<HTMLDivElement>;
  canvas: Ref<HTMLDivElement>;
  grabMove?: boolean;
};

/**
 * The dom shell the scene hangs in: a controller box, the Stage container in it
 * and the editing overlay over that. Scroll and zoom moved onto the scene's
 * layers, so the shell is viewport sized rather than schema sized.
 */
const Canvas: FC<CanvasProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  let stage: Stage | null = null;

  onMounted(() => {
    const { store } = app.value;
    const { viewport } = store.state.editor;

    const $stage = new Stage({
      container: props.canvas.value,
      width: viewport.width,
      height: viewport.height,
    });

    stage = $stage;
    registerStage(STAGE_NAME, $stage);
    renderCanvasScene($stage, { root: props.root });

    addUnsubscribe(
      trackSceneHits($stage),
      watch(viewport).subscribe(() => {
        $stage.size({ width: viewport.width, height: viewport.height });
      }),
      () => {
        stage = null;
        unregisterStage(STAGE_NAME, $stage);
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
      '@/components/erd/canvas/CanvasScene',
      (mod: any) => {
        if (!stage || !mod) return;
        mod.renderCanvasScene(stage, { root: props.root });
      }
    );
  }

  return () => {
    const { store } = app.value;
    const { viewport } = store.state.editor;

    return (
      <div
        class={styles.controller}
        style={{
          width: `${viewport.width}px`,
          height: `${viewport.height}px`,
          'min-width': `${viewport.width}px`,
          'min-height': `${viewport.height}px`,
          'pointer-events': props.grabMove ? 'none' : 'auto',
        }}
      >
        <div
          class={styles.stage}
          data-testid="erd-canvas"
          use:ref={ref(props.canvas)}
          style={{
            width: `${viewport.width}px`,
            height: `${viewport.height}px`,
            'min-width': `${viewport.width}px`,
            'min-height': `${viewport.height}px`,
          }}
        ></div>
        <EditOverlay />
      </div>
    );
  };
};

export default Canvas;

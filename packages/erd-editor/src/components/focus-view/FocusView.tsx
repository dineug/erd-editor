import {
  createRef,
  FC,
  onMounted,
  type Ref,
  ref,
  useProvider,
} from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Canvas from '@/components/erd/canvas/Canvas';
import * as erdStyles from '@/components/erd/Erd.styles';
import Minimap from '@/components/erd/minimap/Minimap';
import { ZOOM_RESET, ZOOM_STEP } from '@/components/erd/useErdShortcut';
import { sceneSourceContext } from '@/components/sceneSourceContext';
import { useViewGestures } from '@/components/visualization/useViewGestures';
import { Open } from '@/constants/open';
import { ViewKind } from '@/engine/modules/editor/state';
import {
  changeZoomLevelAction$,
  streamZoomLevelAction$,
} from '@/engine/modules/settings/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { getSceneContentRect } from '@/konva/scene/contentBounds';
import { closeColorPickerAction } from '@/utils/emitter';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import FocusBar from './FocusBar';
import { leaveFocusView } from './focusExit';
import { keepFocusPlaced } from './focusLayout';
import * as styles from './FocusView.styles';

/** The slot the Focus scene reads, which is the active view for as long as it is open. */
const SOURCE = ViewKind.focus;

type FocusSceneProps = {
  root: Ref<HTMLDivElement>;
  canvas: Ref<HTMLDivElement>;
};

/**
 * The scene and its map under one provider. A component provides on its
 * parent element, so this sits inside the scene box and the source reaches
 * the canvas and the map, and neither the bar beside them nor anything at the editor root.
 */
const FocusScene: FC<FocusSceneProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const sceneSource = useProvider(ctx, sceneSourceContext, SOURCE);
  const { addUnsubscribe } = useUnmounted();
  addUnsubscribe(() => sceneSource.destroy());

  return () => {
    const { store } = app.value;
    // A view that places nothing has no travel and draws no map, exactly as
    // an empty document draws none.
    const hasContent = getSceneContentRect(store.state, SOURCE) !== null;

    return (
      <>
        <Canvas root={props.root} canvas={props.canvas} />
        {hasContent ? <Minimap /> : null}
      </>
    );
  };
};

type FocusOverlayProps = {};

/**
 * Whether a stop chord is the overlay's to take: the search and the theme
 * builder draw over it and close on the same chord, and the reader who
 * dismisses one of them means to stay in the view under it.
 */
const ownsStop = ({ openMap }: { openMap: Record<string, boolean> }) =>
  !openMap[Open.search] && !openMap[Open.themeBuilder];

/**
 * The overlay while a Focus view is open: the bar over a scene box the size
 * of the viewport, with the view's own wheel, pan and marquee on the box, and
 * the view kept placed under it. The stop chord leaves it the way the button does, and the zoom chords zoom the view, since the ERD's are gated off under it.
 */
const FocusOverlay: FC<FocusOverlayProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const root = createRef<HTMLDivElement>();
  const canvas = createRef<HTMLDivElement>();
  const { handleWheel, handleMousedown } = useViewGestures(ctx, {
    root,
    canvas,
    source: SOURCE,
  });
  const { addUnsubscribe } = useUnmounted();

  onMounted(() => {
    const { store, shortcut$, emitter } = app.value;

    // A colour picker left open on the ERD floats over the overlay, and the
    // press that would close it lands on the overlay instead.
    emitter.emit(closeColorPickerAction());

    addUnsubscribe(
      keepFocusPlaced(app.value),
      shortcut$.subscribe(({ type }) => {
        type === KeyBindingName.stop &&
          ownsStop(store.state.editor) &&
          leaveFocusView(store);
        type === KeyBindingName.zoomIn &&
          store.dispatch(streamZoomLevelAction$(ZOOM_STEP, SOURCE));
        type === KeyBindingName.zoomOut &&
          store.dispatch(streamZoomLevelAction$(-ZOOM_STEP, SOURCE));
        type === KeyBindingName.zoomReset &&
          store.dispatch(changeZoomLevelAction$(ZOOM_RESET, SOURCE));
      })
    );
  });

  return () => {
    const { viewport } = app.value.store.state.editor;

    return (
      <div
        class={['focus-view', styles.root]}
        style={{
          width: `${viewport.width}px`,
          height: `${viewport.height}px`,
        }}
      >
        <div
          class={[erdStyles.root, styles.scene]}
          use:ref={ref(root)}
          on:mousedown={handleMousedown}
          on:touchstart={handleMousedown}
          on:wheel={handleWheel}
        >
          <FocusScene root={root} canvas={canvas} />
        </div>
        <FocusBar />
      </div>
    );
  };
};

export type FocusViewProps = {};

/**
 * The Focus view's place at the editor root: one component whichever tab is
 * up, drawn only while a Focus view is open, and mounted beside the tabs
 * rather than in one so a tab change under it neither closes nor moves it.
 */
const FocusView: FC<FocusViewProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  return () =>
    app.value.store.state.editor.views.focus ? <FocusOverlay /> : null;
};

export default FocusView;

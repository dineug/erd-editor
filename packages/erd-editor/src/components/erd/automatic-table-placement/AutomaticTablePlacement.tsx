import { query, toJson } from '@dineug/erd-editor-schema';
import {
  createRef,
  FC,
  observable,
  Ref,
  ref,
  useProvider,
  watch,
} from '@dineug/r-html';
import { clamp } from 'es-toolkit';
import { round } from 'es-toolkit/compat';

import {
  AppContext,
  appContext,
  appDestroy,
  createAppContext,
} from '@/components/appContext';
import Canvas from '@/components/erd/canvas/Canvas';
import Minimap from '@/components/erd/minimap/Minimap';
import {
  getScrollToCenter,
  getViewTransform,
} from '@/components/erd/minimap/minimapGeometry';
import Button from '@/components/primitives/button/Button';
import Toast from '@/components/primitives/toast/Toast';
import { Open } from '@/constants/open';
import { CANVAS_ZOOM_MIN } from '@/constants/schema';
import {
  changeOpenMapAction,
  changeViewportAction,
} from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import type { Viewport } from '@/engine/modules/editor/state';
import {
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { Point } from '@/internal-types';
import { getContentRect } from '@/konva/scene/contentBounds';
import type { Rect } from '@/konva/scene/metrics';
import { openToastAction } from '@/utils/emitter';
import { KeyBindingName } from '@/utils/keyboard-shortcut';
import { closePromise } from '@/utils/promise';

import * as styles from './AutomaticTablePlacement.styles';
import {
  createAutomaticTablePlacement,
  placementProgress,
} from './createAutomaticTablePlacement';

export type AutomaticTablePlacementProps = {
  app: Ref<AppContext>;
  onChange: (tables: TablePoint[]) => void;
};

export type TablePoint = {
  id: string;
  x: number;
  y: number;
};

/**
 * Scene units left around the content when the preview fits it, so a table at
 * the edge of the document is not flush against the edge of the screen.
 */
export const FIT_PADDING = 200;

/** The closest the preview opens at: the whole document is what it is for. */
export const PREVIEW_ZOOM_MAX = 0.7;

/**
 * The zoom the preview opens at: the content with its padding fitted into the
 * screen on both axes, rounded to the two places a zoom is kept to, and held
 * between the floor every zoom has and the ceiling above.
 */
export function previewZoomLevel(content: Rect, viewport: Viewport): number {
  const fit = Math.min(
    viewport.width / (content.width + FIT_PADDING),
    viewport.height / (content.height + FIT_PADDING)
  );

  return clamp(round(fit, 2), CANVAS_ZOOM_MIN, PREVIEW_ZOOM_MAX);
}

/** What a document drawing nothing is fitted to, which is a point at the origin. */
const EMPTY_RECT = { x: 0, y: 0, width: 0, height: 0 };

/** The middle of a box, which is what the view and the forces are centred on. */
const centerOfRect = ({ x, y, width, height }: Rect): Point => ({
  x: x + width / 2,
  y: y + height / 2,
});

type PlacementToastProps = {
  progress: { value: number };
  onApply: () => void;
  onCancel: () => void;
};

/**
 * The message up while the tables settle, following the simulation as it
 * cools. Apply takes the layout as it stands, Cancel puts every table back.
 */
const PlacementToast: FC<PlacementToastProps> = props => () => {
  const { value } = props.progress;

  return (
    <Toast
      progress={value}
      description={`Placing tables… ${Math.round(value * 100)}%`}
      action={
        <>
          <Button
            variant="soft"
            size="1"
            text="Apply"
            onClick={props.onApply}
          />
          <Button size="1" text="Cancel" onClick={props.onCancel} />
        </>
      }
    />
  );
};

const AutomaticTablePlacement: FC<AutomaticTablePlacementProps> = (
  props,
  ctx
) => {
  const root = createRef<HTMLDivElement>();
  const canvas = createRef<HTMLDivElement>();
  const originApp = props.app.value;
  const app = createAppContext({
    toWidth: originApp.toWidth,
  });
  const { addUnsubscribe } = useUnmounted();
  const provider = useProvider(ctx, appContext, app);

  const {
    store: { state: originState },
  } = originApp;
  const { store } = app;

  const getViewport = () => ({ ...originApp.store.state.editor.viewport });

  addUnsubscribe(
    watch(originApp.store.state.editor.viewport).subscribe(() => {
      app.store.dispatch(changeViewportAction(getViewport()));
    }),
    () => {
      provider.destroy();
      appDestroy(app);
    }
  );

  // The preview shows everything the document draws, fitted once and centred in
  // the viewport, with the zoom the dispatch below puts in effect rather than
  // the current one. An empty document closes the overlay a few lines down.
  const contentRect = getContentRect(originState) ?? EMPTY_RECT;
  const zoomLevel = previewZoomLevel(contentRect, originState.editor.viewport);
  const previewOrigin = getScrollToCenter(
    { ...getViewTransform(originState), zoomLevel },
    centerOfRect(contentRect)
  );

  store.dispatchSync(
    initialLoadJsonAction$(toJson(originState)),
    changeViewportAction(getViewport()),
    changeZoomLevelAction({ value: zoomLevel }),
    scrollToAction({ originX: previewOrigin.x, originY: previewOrigin.y })
  );

  const {
    doc: { tableIds },
    collections,
  } = store.state;

  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds);

  const [close, onClose] = closePromise();

  let isClosed = false;

  const handleClose = () => {
    isClosed = true;
    onClose();
    originApp.store.dispatch(
      changeOpenMapAction({ [Open.automaticTablePlacement]: false })
    );
  };

  if (!tables.length) {
    handleClose();
    originApp.emitter.emit(
      openToastAction({
        message: <Toast description="No tables to place" />,
      })
    );
    return () => null;
  }

  try {
    const simulation = createAutomaticTablePlacement(store.state);

    const handleStop = () => {
      if (isClosed) return;

      simulation.stop();
      props.onChange(
        tables.map(table => ({
          id: table.id,
          x: table.ui.x,
          y: table.ui.y,
        }))
      );
      handleClose();
    };

    const handleCancel = () => {
      simulation.stop();
      handleClose();
    };

    const progress = observable({ value: 0 });

    simulation.on('tick.progress', () => {
      progress.value = placementProgress(simulation);
    });

    originApp.emitter.emit(
      openToastAction({
        close,
        message: (
          <PlacementToast
            progress={progress}
            onApply={handleStop}
            onCancel={handleCancel}
          />
        ),
      })
    );

    simulation.on('end', handleStop);
    addUnsubscribe(
      originApp.shortcut$.subscribe(({ type }) => {
        type === KeyBindingName.stop && handleCancel();
      })
    );
  } catch (e) {
    handleClose();

    return () => null;
  }

  return () => (
    <div class={styles.root}>
      <div class={styles.container} use:ref={ref(root)}>
        <Canvas root={root} canvas={canvas} grabMove={true} />
        <Minimap />
      </div>
    </div>
  );
};

export default AutomaticTablePlacement;

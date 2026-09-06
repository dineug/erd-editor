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
import { getScrollToCenter } from '@/components/erd/minimap/minimapGeometry';
import Button from '@/components/primitives/button/Button';
import Toast from '@/components/primitives/toast/Toast';
import { Open } from '@/constants/open';
import { CANVAS_ZOOM_MIN } from '@/constants/schema';
import {
  changeOpenMapAction,
  changeViewportAction,
} from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import {
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
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

  const zoomInRange = (value: number) => clamp(value, CANVAS_ZOOM_MIN, 0.7);
  const zoomLevelInRange = (zoom: number) => round(zoomInRange(zoom), 2);

  // The preview shows the whole canvas box centred in the viewport, computed
  // with the zoom the dispatch below puts in effect rather than the current one.
  const previewZoomLevel = zoomLevelInRange(
    originState.editor.viewport.width / originState.settings.width
  );
  const { width, height, originX, originY } = originState.settings;
  const previewOrigin = getScrollToCenter(
    {
      width,
      height,
      originX,
      originY,
      zoomLevel: previewZoomLevel,
      viewportWidth: originState.editor.viewport.width,
      viewportHeight: originState.editor.viewport.height,
    },
    { x: width / 2, y: height / 2 }
  );

  store.dispatchSync(
    initialLoadJsonAction$(toJson(originState)),
    changeViewportAction(getViewport()),
    changeZoomLevelAction({ value: previewZoomLevel }),
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

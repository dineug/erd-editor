import { query, toJson } from '@dineug/erd-editor-schema';
import { createRef, FC, html, Ref, ref, useProvider } from '@dineug/r-html';
import { createInRange } from '@dineug/shared';
import { round } from 'lodash-es';

import {
  AppContext,
  appContext,
  appDestroy,
  createAppContext,
} from '@/components/appContext';
import Canvas from '@/components/erd/canvas/Canvas';
import Minimap from '@/components/erd/minimap/Minimap';
import Button from '@/components/primitives/button/Button';
import Toast from '@/components/primitives/toast/Toast';
import { Open } from '@/constants/open';
import { CANVAS_ZOOM_MIN } from '@/constants/schema';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
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
import { createAutomaticTablePlacement } from './createAutomaticTablePlacement';

export type AutomaticTablePlacementProps = {
  app: Ref<AppContext>;
  onChange: (tables: TablePoint[]) => void;
};

export type TablePoint = {
  id: string;
  x: number;
  y: number;
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

  addUnsubscribe(() => {
    provider.destroy();
    appDestroy(app);
  });

  const zoomInRange = createInRange(CANVAS_ZOOM_MIN, 0.7);
  const zoomLevelInRange = (zoom: number) => round(zoomInRange(zoom), 2);

  store.dispatchSync(
    initialLoadJsonAction$(toJson(originState)),
    changeZoomLevelAction({
      value: zoomLevelInRange(
        originState.editor.viewport.width / originState.settings.width
      ),
    }),
    scrollToAction({
      scrollLeft:
        -1 *
        (originState.settings.width / 2 -
          originState.editor.viewport.width / 2),
      scrollTop:
        -1 *
        (originState.settings.height / 2 -
          originState.editor.viewport.height / 2),
    })
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
        message: html`<${Toast} description="Not found tables" />`,
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

    originApp.emitter.emit(
      openToastAction({
        close,
        message: html`
          <${Toast}
            description="Automatic Table Placement..."
            action=${html`
              <${Button}
                variant="soft"
                size="1"
                text="Stop"
                .onClick=${handleStop}
              />
              <${Button} size="1" text="Cancel" .onClick=${handleCancel} />
            `}
          />
        `,
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

  return () => html`
    <div class=${styles.root}>
      <div class=${styles.container} ${ref(root)}>
        <${Canvas} root=${root} canvas=${canvas} />
        <${Minimap} />
      </div>
    </div>
  `;
};

export default AutomaticTablePlacement;

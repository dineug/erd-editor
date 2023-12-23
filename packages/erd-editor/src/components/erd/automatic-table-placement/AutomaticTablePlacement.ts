import { query, toJson } from '@dineug/erd-editor-schema';
import { createRef, FC, html, Ref, useProvider } from '@dineug/r-html';
import { createInRange } from '@dineug/shared';
import { round } from 'lodash-es';

import {
  AppContext,
  appContext,
  createAppContext,
} from '@/components/appContext';
import Canvas from '@/components/erd/canvas/Canvas';
import Minimap from '@/components/erd/minimap/Minimap';
import Button from '@/components/primitives/button/Button';
import Toast from '@/components/primitives/toast/Toast';
import { Open } from '@/constants/open';
import { CANVAS_ZOOM_MIN } from '@/constants/schema';
import {
  changeOpenMapAction,
  initialClearAction,
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
import { createAutomaticTablePlacement } from './createAutomaticTablePlacement';

export type AutomaticTablePlacementProps = {
  app: Ref<AppContext>;
  root: Ref<HTMLDivElement>;
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
  const canvas = createRef<HTMLDivElement>();
  const prevApp = props.app.value;
  const appContextValue = createAppContext({
    toWidth: prevApp.toWidth,
  });
  const { addUnsubscribe } = useUnmounted();
  const provider = useProvider(ctx, appContext, appContextValue);

  const {
    store: { state: prevState },
    emitter,
    shortcut$,
  } = prevApp;
  const { store } = appContextValue;

  addUnsubscribe(provider.destroy, store.destroy, () => {
    store.dispatch(initialClearAction());
  });

  const zoomInRange = createInRange(CANVAS_ZOOM_MIN, 0.7);
  const zoomLevelInRange = (zoom: number) => round(zoomInRange(zoom), 2);

  store.dispatchSync(
    initialLoadJsonAction$(toJson(prevState)),
    changeZoomLevelAction({
      value: zoomLevelInRange(
        prevState.editor.viewport.width / prevState.settings.width
      ),
    }),
    scrollToAction({
      scrollLeft:
        -1 *
        (prevState.settings.width / 2 - prevState.editor.viewport.width / 2),
      scrollTop:
        -1 *
        (prevState.settings.height / 2 - prevState.editor.viewport.height / 2),
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
    prevApp.store.dispatch(
      changeOpenMapAction({ [Open.automaticTablePlacement]: false })
    );
  };

  if (!tables.length) {
    handleClose();
    emitter.emit(
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

    emitter.emit(
      openToastAction({
        close,
        message: html`
          <${Toast}
            description="Automatic Table Placement..."
            action=${html`
              <${Button}
                variant="soft"
                size="1"
                text=${'Stop'}
                .onClick=${handleStop}
              />
              <${Button} size="1" text=${'Cancel'} .onClick=${handleCancel} />
            `}
          />
        `,
      })
    );

    simulation.on('end', handleStop);
    addUnsubscribe(
      shortcut$.subscribe(({ type }) => {
        type === KeyBindingName.stop && handleCancel();
      })
    );
  } catch (e) {
    handleClose();

    return () => null;
  }

  return () => html`
    <div class=${styles.root}>
      <div class=${styles.container}>
        <${Canvas} root=${props.root} canvas=${canvas} />
        <${Minimap} />
      </div>
    </div>
  `;
};

export default AutomaticTablePlacement;

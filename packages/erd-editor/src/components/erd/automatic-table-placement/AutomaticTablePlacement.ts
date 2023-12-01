import { toJson } from '@dineug/erd-editor-schema';
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
import { CANVAS_ZOOM_MIN } from '@/constants/schema';
import { endAutomaticTablePlacementAction } from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import {
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { query } from '@/utils/collection/query';
import { openToastAction } from '@/utils/emitter';
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
  useProvider(ctx, appContext, appContextValue);

  const {
    store: { state: prevState },
    emitter,
  } = prevApp;
  const { store } = appContextValue;

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

  const handleCancel = () => {
    onClose();
    prevApp.store.dispatch(endAutomaticTablePlacementAction());
  };

  if (!tables.length) {
    handleCancel();
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
      simulation.stop();
      props.onChange(
        tables.map(table => ({
          id: table.id,
          x: table.ui.x,
          y: table.ui.y,
        }))
      );
      handleCancel();
    };

    emitter.emit(
      openToastAction({
        close,
        message: html`
          <${Toast}
            description="Automatic Table Placement..."
            action=${html`
              <${Button} size="1" text=${'Stop'} .onClick=${handleStop} />
              <${Button} size="1" text=${'Cancel'} .onClick=${handleCancel} />
            `}
          />
        `,
      })
    );

    simulation.on('end', handleStop);
  } catch (e) {
    handleCancel();
  }

  return () =>
    html`
      <div class=${styles.root}>
        <div class=${styles.container}>
          <${Canvas} root=${props.root} canvas=${canvas} />
          <${Minimap} />
        </div>
      </div>
    `;
};

export default AutomaticTablePlacement;
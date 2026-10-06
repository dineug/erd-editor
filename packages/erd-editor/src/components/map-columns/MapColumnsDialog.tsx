import { query } from '@dineug/erd-editor-schema';
import { FC, observable, onMounted, watch } from '@dineug/r-html';
import { filter } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import Dialog, {
  DIALOG_STACK_BELOW,
} from '@/components/primitives/dialog/Dialog';
import Toast from '@/components/primitives/toast/Toast';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { openMapColumnsAction, openToastAction } from '@/utils/emitter';
import { KeyBindingName } from '@/utils/keyboard-shortcut';
import {
  buildMapColumns,
  changeMapColumnsKey,
  ColumnPick,
  MapColumnsClosed,
  MapColumnsSession,
  MapColumnsView,
  openCreateSession,
  openEditSession,
  pickMapColumn,
} from '@/utils/map-columns';

import { mapColumnsAction$ } from './mapColumnsAction';
import MapColumnsBody from './MapColumnsBody';
import { mapColumnsText, nameOf } from './mapColumnsText';

export type MapColumnsDialogProps = {
  readonly: boolean;
  isDarkMode: boolean;
};

const DIALOG_MAX_WIDTH = 480;

/**
 * Maps a parent's key onto the child's columns, for a relationship drawn or
 * held. Built from the document on every render, it shows a peer's change at
 * once and closes on its own once what it maps between is gone.
 */
const MapColumnsDialog: FC<MapColumnsDialogProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const current = observable(
    { session: null as MapColumnsSession | null },
    { shallow: true }
  );

  const isOpen = () =>
    Boolean(app.value.store.state.editor.openMap[Open.mapColumns]);

  /** Whether the dialog may stand: the ERD tab up and the editor writable. */
  const canStand = () =>
    !props.readonly &&
    app.value.store.state.settings.canvasType === CanvasType.ERD;

  const close = () => {
    const { store } = app.value;
    store.dispatch(changeOpenMapAction({ [Open.mapColumns]: false }));
  };

  const toast = (title: string) => {
    app.value.emitter.emit(
      openToastAction({ message: <Toast title={title} /> })
    );
  };

  const closedText = (closed: MapColumnsClosed) => {
    if (closed.reason === 'relationshipRemoved') {
      return mapColumnsText('mapColumns.closedRelationshipRemoved');
    }

    const table = query(app.value.store.state.collections)
      .collection('tableEntities')
      .selectById(closed.tableId);
    return mapColumnsText('mapColumns.closedTableRemoved', {
      table: table ? nameOf(table) : mapColumnsText('common.unnamed'),
    });
  };

  const open = ({ payload }: ReturnType<typeof openMapColumnsAction>) => {
    const { state } = app.value.store;
    current.session =
      payload.mode === 'create'
        ? openCreateSession(state, payload)
        : openEditSession(state, payload.relationshipId);
  };

  /**
   * Closes the dialog once it can no longer stand, telling the reader why when
   * a table or the relationship it maps went, and lets its session go at once
   * so a batch landing before the close says nothing twice.
   */
  const checkStanding = () => {
    const { session } = current;
    if (!session || !isOpen()) return;

    if (!canStand()) {
      current.session = null;
      close();
      return;
    }

    const built = buildMapColumns(app.value.store.state, session);
    if (built.closed === null) return;

    current.session = null;
    close();
    toast(closedText(built.closed));
  };

  const update = (
    change: (session: MapColumnsSession) => MapColumnsSession
  ) => {
    const { session } = current;
    if (!session) return;
    current.session = change(session);
  };

  const handleKeyChange = (keyId: string) => {
    update(session =>
      changeMapColumnsKey(app.value.store.state, session, keyId)
    );
  };

  const handlePick = (parentColumnId: string, pick: ColumnPick | null) => {
    update(session =>
      pickMapColumn(app.value.store.state, session, parentColumnId, pick)
    );
  };

  /** Sends the mapping once and closes; the write itself is judged where it lands. */
  const confirm = (view: MapColumnsView) => {
    if (!view.canConfirm) return;

    const { store } = app.value;
    store.dispatch(
      mapColumnsAction$(view.draft, {
        onRefuse: () => toast(mapColumnsText('mapColumns.failed')),
      })
    );
    close();
  };

  onMounted(() => {
    const { store, emitter, shortcut$ } = app.value;

    addUnsubscribe(
      emitter.on({ openMapColumns: open }),
      // Escape inside the box never gets here; one pressed while the focus is
      // elsewhere in the element does, and the canvas behind ignores it.
      shortcut$
        .pipe(filter(({ type }) => type === KeyBindingName.stop))
        .subscribe(() => isOpen() && close()),
      // Whatever closed it, Find and Replace and the palette included, drops
      // the session, so the next opening inherits nothing of this one; an
      // opening with no session, as in a readonly editor, closes at once.
      watch(store.state.editor.openMap).subscribe(name => {
        if (name !== Open.mapColumns) return;
        if (!isOpen()) {
          current.session = null;
        } else if (!current.session || !canStand()) {
          current.session = null;
          close();
        }
      }),
      store.subscribe(checkStanding),
      watch(props).subscribe(name => {
        name === 'readonly' && checkStanding();
      }),
      () => {
        current.session = null;
      }
    );
  });

  return () => {
    const { session } = current;
    if (!session || !isOpen() || !canStand()) return null;

    const { store } = app.value;
    const view = buildMapColumns(store.state, session);
    if (view.closed !== null) return null;

    const stacked = store.state.editor.viewport.width < DIALOG_STACK_BELOW;

    return (
      <Dialog
        label={mapColumnsText('mapColumns.title')}
        maxWidth={DIALOG_MAX_WIDTH}
        onClose={close}
        children={
          <MapColumnsBody
            mode={session.mode}
            view={view}
            stacked={stacked}
            isDarkMode={props.isDarkMode}
            onKeyChange={handleKeyChange}
            onPick={handlePick}
            onCancel={close}
            onConfirm={() => confirm(view)}
          />
        }
      />
    );
  };
};

export default MapColumnsDialog;

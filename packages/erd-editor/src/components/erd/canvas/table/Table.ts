import { query } from '@dineug/erd-editor-schema';
import {
  createRef,
  FC,
  html,
  observable,
  onMounted,
  onUpdated,
  ref,
  repeat,
} from '@dineug/r-html';
import { Subscription } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import Column from '@/components/erd/canvas/table/column/Column';
import EditInput from '@/components/primitives/edit-input/EditInput';
import Icon from '@/components/primitives/icon/Icon';
import { Show } from '@/constants/schema';
import {
  dragendColumnAction,
  editTableAction,
  editTableEndAction,
  focusTableAction,
} from '@/engine/modules/editor/atom.actions';
import {
  dragoverColumnAction$,
  dragstartColumnAction$,
} from '@/engine/modules/editor/generator.actions';
import { FocusType } from '@/engine/modules/editor/state';
import {
  changeTableCommentAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { removeTableAction$ } from '@/engine/modules/table/generator.actions';
import { addColumnAction$ } from '@/engine/modules/table-column/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';
import { onPrevent } from '@/utils/domEvent';
import { dragendColumnAllAction, openColorPickerAction } from '@/utils/emitter';
import { FlipAnimation } from '@/utils/flipAnimation';
import { isMod, simpleShortcutToString } from '@/utils/keyboard-shortcut';
import { fromShadowDraggable } from '@/utils/rx-operators/fromShadowDraggable';
import { takeUnsubscribe } from '@/utils/rx-operators/takeUnsubscribe';

import * as styles from './Table.styles';
import { useFocusTable } from './useFocusTable';
import { useMoveTable } from './useMoveTable';

export type TableProps = {
  table: Table;
};

const Table: FC<TableProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const root = createRef<HTMLDivElement>();
  const { hasEdit, hasFocus, hasSelectColumn } = useFocusTable(
    ctx,
    props.table.id
  );
  const { onMoveStart } = useMoveTable(ctx, props);
  const { addUnsubscribe } = useUnmounted();

  const state = observable({
    dragstartId: null as string | null,
  });

  const flipAnimation = new FlipAnimation(
    root,
    '.column-row',
    'column-row-move'
  );

  const handleAddColumn = () => {
    const { store } = app.value;
    store.dispatch(addColumnAction$(props.table.id));
  };

  const handleRemoveTable = () => {
    const { store } = app.value;
    store.dispatch(removeTableAction$(props.table.id));
  };

  const handleFocus = (focusType: FocusType) => {
    const { store } = app.value;
    store.dispatch(focusTableAction({ tableId: props.table.id, focusType }));
  };

  const handleEdit = () => {
    const { store } = app.value;
    store.dispatch(editTableAction());
  };

  const handleEditEnd = () => {
    const { store } = app.value;
    store.dispatch(editTableEndAction());
  };

  const handleInput = (event: InputEvent, focusType: FocusType) => {
    const { store } = app.value;
    const input = event.target as HTMLInputElement | null;
    if (!input) return;

    switch (focusType) {
      case FocusType.tableName:
        store.dispatch(
          changeTableNameAction({ id: props.table.id, value: input.value })
        );
        break;
      case FocusType.tableComment:
        store.dispatch(
          changeTableCommentAction({ id: props.table.id, value: input.value })
        );
        break;
    }
  };

  const handleOpenColorPicker = (event: MouseEvent) => {
    const { emitter } = app.value;
    emitter.emit(
      openColorPickerAction({
        x: event.clientX,
        y: event.clientY,
        color: props.table.ui.color,
      })
    );
  };

  const handleMoveColumn = (targetId: string, targetTableId: string) => {
    const { store } = app.value;
    const {
      editor: { draggableColumn },
    } = store.state;
    if (!draggableColumn || draggableColumn.columnIds.includes(targetId)) {
      return;
    }

    flipAnimation.snapshot();
    store.dispatch(dragoverColumnAction$(targetId, targetTableId));
  };

  let draggableColumnSubscription: Subscription | null = null;

  const draggableColumnSubscribe = () => {
    const $root = root.value;
    if (!$root || draggableColumnSubscription) return;

    const elements = Array.from<HTMLElement>(
      $root.querySelectorAll('.column-row')
    );
    elements.forEach(el => el.classList.add('none-hover'));

    const cleanup = () => {
      elements.forEach(el => el.classList.remove('none-hover'));
      draggableColumnSubscription = null;
      state.dragstartId = null;
    };

    draggableColumnSubscription = fromShadowDraggable(elements, el => ({
      targetId: el.dataset.id as string,
      targetTableId: el.dataset.tableId as string,
    }))
      .pipe(takeUnsubscribe(cleanup))
      .subscribe({
        next: ({ targetId, targetTableId }) => {
          handleMoveColumn(targetId, targetTableId);
        },
        complete: cleanup,
      });
  };

  const handleDragstartColumn = (event: DragEvent) => {
    const { store } = app.value;
    const {
      editor: { focusTable },
    } = store.state;
    const $target = event.target as HTMLElement | null;
    if (!$target || !focusTable || !focusTable.columnId) {
      return;
    }

    const dragstartId = $target.dataset?.id;
    if (!dragstartId) return;

    state.dragstartId = dragstartId;

    store.dispatch(dragstartColumnAction$(isMod(event)));
    draggableColumnSubscribe();
  };

  const handleDragendColumn = () => {
    const { store, emitter } = app.value;
    store.dispatch(dragendColumnAction());
    emitter.emit(dragendColumnAllAction());
  };

  const handleDragenter = () => {
    const { store } = app.value;
    const {
      editor: { draggableColumn },
    } = store.state;
    if (!draggableColumn) return;

    draggableColumnSubscribe();
  };

  onUpdated(() => flipAnimation.play());

  onMounted(() => {
    const { emitter } = app.value;

    addUnsubscribe(
      emitter.on({
        dragendColumnAll: () => {
          draggableColumnSubscription?.unsubscribe();
        },
      })
    );
  });

  return () => {
    const { store, keyBindingMap } = app.value;
    const { editor, settings, collections } = store.state;
    const { table } = props;
    const selected = Boolean(editor.selectedMap[table.id]);
    const tableWidths = calcTableWidths(table, store.state);
    const height = calcTableHeight(table);

    const isGhostColumn =
      state.dragstartId !== null &&
      !table.columnIds.includes(state.dragstartId);

    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(
        isGhostColumn
          ? [...table.columnIds, state.dragstartId as string]
          : table.columnIds
      );

    return html`
      <div
        class=${['table', styles.root]}
        style=${{
          top: `${table.ui.y}px`,
          left: `${table.ui.x}px`,
          'z-index': `${table.ui.zIndex}`,
          width: `${tableWidths.width}px`,
          height: `${height}px`,
        }}
        ${ref(root)}
        ?data-selected=${selected}
        ?data-focus-border=${selected}
        data-id=${table.id}
        @mousedown=${onMoveStart}
        @touchstart=${onMoveStart}
      >
        <div class=${styles.header}>
          <div
            class=${['table-header-color', styles.headerColor]}
            style=${{
              'background-color': table.ui.color,
            }}
            @click=${handleOpenColorPicker}
          ></div>
          <div class=${styles.headerButtonWrap}>
            <${Icon}
              size=${12}
              name="plus"
              title=${simpleShortcutToString(
                keyBindingMap.addColumn[0]?.shortcut
              )}
              useTransition=${true}
              .onClick=${handleAddColumn}
            />
            <${Icon}
              size=${12}
              name="xmark"
              title=${simpleShortcutToString(
                keyBindingMap.removeTable[0]?.shortcut
              )}
              useTransition=${true}
              .onClick=${handleRemoveTable}
            />
          </div>
          <div class=${styles.headerInputWrap}>
            <div
              class="input-padding"
              @mousedown=${() => {
                handleFocus(FocusType.tableName);
              }}
              @dblclick=${handleEdit}
            >
              <${EditInput}
                placeholder="table"
                width=${table.ui.widthName}
                value=${table.name}
                focus=${hasFocus(FocusType.tableName)}
                edit=${hasEdit(FocusType.tableName)}
                autofocus=${true}
                .onBlur=${handleEditEnd}
                .onInput=${(event: InputEvent) => {
                  handleInput(event, FocusType.tableName);
                }}
              />
            </div>
            ${bHas(settings.show, Show.tableComment)
              ? html`
                  <div
                    class="input-padding"
                    @mousedown=${() => {
                      handleFocus(FocusType.tableComment);
                    }}
                    @dblclick=${handleEdit}
                  >
                    <${EditInput}
                      placeholder="comment"
                      width=${settings.maxWidthComment === -1
                        ? table.ui.widthComment
                        : settings.maxWidthComment < table.ui.widthComment
                          ? settings.maxWidthComment
                          : table.ui.widthComment}
                      value=${table.comment}
                      focus=${hasFocus(FocusType.tableComment)}
                      edit=${hasEdit(FocusType.tableComment)}
                      autofocus=${true}
                      .onBlur=${handleEditEnd}
                      .onInput=${(event: InputEvent) => {
                        handleInput(event, FocusType.tableComment);
                      }}
                    />
                  </div>
                `
              : null}
          </div>
        </div>
        <div
          @dragenter=${handleDragenter}
          @dragenter=${onPrevent}
          @dragover=${onPrevent}
        >
          ${repeat(
            columns,
            column => column.id,
            column => html`
              <${Column}
                app=${app}
                column=${column}
                selected=${hasSelectColumn(column.id)}
                widthName=${tableWidths.name}
                widthDataType=${tableWidths.dataType}
                widthDefault=${tableWidths.default}
                widthComment=${tableWidths.comment}
                focusName=${hasFocus(FocusType.columnName, column.id)}
                focusDataType=${hasFocus(FocusType.columnDataType, column.id)}
                focusNotNull=${hasFocus(FocusType.columnNotNull, column.id)}
                focusDefault=${hasFocus(FocusType.columnDefault, column.id)}
                focusComment=${hasFocus(FocusType.columnComment, column.id)}
                focusUnique=${hasFocus(FocusType.columnUnique, column.id)}
                focusAutoIncrement=${hasFocus(
                  FocusType.columnAutoIncrement,
                  column.id
                )}
                editName=${hasEdit(FocusType.columnName, column.id)}
                editDataType=${hasEdit(FocusType.columnDataType, column.id)}
                editDefault=${hasEdit(FocusType.columnDefault, column.id)}
                editComment=${hasEdit(FocusType.columnComment, column.id)}
                draggable=${true}
                ghost=${isGhostColumn && column.id === state.dragstartId}
                .onDragstart=${handleDragstartColumn}
                .onDragend=${handleDragendColumn}
              />
            `
          )}
        </div>
      </div>
    `;
  };
};

export default Table;

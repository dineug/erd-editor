import { DOMTemplateLiterals, FC, Ref, repeat } from '@dineug/r-html';

import { AppContext, useAppContext } from '@/components/appContext';
import ColumnDataType from '@/components/erd/canvas/table/column/column-data-type/ColumnDataType';
import ColumnKey from '@/components/erd/canvas/table/column/column-key/ColumnKey';
import ColumnNotNull from '@/components/erd/canvas/table/column/column-not-null/ColumnNotNull';
import ColumnOption from '@/components/erd/canvas/table/column/column-option/ColumnOption';
import EditInput from '@/components/primitives/edit-input/EditInput';
import Icon from '@/components/primitives/icon/Icon';
import {
  COLUMN_AUTO_INCREMENT_WIDTH,
  COLUMN_UNIQUE_WIDTH,
} from '@/constants/layout';
import {
  ColumnOption as ColumnOptionType,
  ColumnType,
  Show,
} from '@/constants/schema';
import {
  editTableAction,
  editTableEndAction,
  focusColumnAction,
} from '@/engine/modules/editor/atom.actions';
import {
  columnKeyHoverEndAction$,
  columnKeyHoverStartAction$,
} from '@/engine/modules/editor/generator.actions';
import { FocusType } from '@/engine/modules/editor/state';
import {
  changeColumnValueAction$,
  isToggleColumnTypes,
  removeColumnAction$,
  toggleColumnValueAction$,
} from '@/engine/modules/table-column/generator.actions';
import type { Column } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { isMod, simpleShortcutToString } from '@/utils/keyboard-shortcut';

import * as styles from './Column.styles';

export type ColumnProps = {
  app: Ref<AppContext>;
  column: Column;
  selected: boolean;
  widthName: number;
  widthDataType: number;
  widthDefault: number;
  widthComment: number;
  focusName: boolean;
  focusDataType: boolean;
  focusNotNull: boolean;
  focusDefault: boolean;
  focusComment: boolean;
  focusUnique: boolean;
  focusAutoIncrement: boolean;
  sharedFocusName: string | null;
  sharedFocusDataType: string | null;
  sharedFocusNotNull: string | null;
  sharedFocusDefault: string | null;
  sharedFocusComment: string | null;
  sharedFocusUnique: string | null;
  sharedFocusAutoIncrement: string | null;
  editName: boolean;
  editDataType: boolean;
  editDefault: boolean;
  editComment: boolean;
  draggable?: boolean;
  ghost?: boolean;
  onDragstart?: (event: DragEvent) => void;
  onDragend?: (event: DragEvent) => void;
};

type ColumnOrderTpl = {
  columnType: number;
  template: DOMTemplateLiterals | null;
};

const Column: FC<ColumnProps> = (props, ctx) => {
  const app = useAppContext(ctx, props.app?.value);

  const handleRemoveColumn = () => {
    const { store } = app.value;
    store.dispatch(
      removeColumnAction$(props.column.tableId, [props.column.id])
    );
  };

  const handleFocus = (event: MouseEvent, focusType: FocusType) => {
    const { store } = app.value;
    store.dispatch(
      focusColumnAction({
        tableId: props.column.tableId,
        columnId: props.column.id,
        focusType,
        $mod: isMod(event),
        shiftKey: event.shiftKey,
      })
    );
  };

  const handleEdit = (focusType: FocusType) => {
    const { store } = app.value;
    store.dispatch(
      isToggleColumnTypes(focusType)
        ? toggleColumnValueAction$(
            focusType,
            props.column.tableId,
            props.column.id
          )
        : editTableAction()
    );
  };

  const handleEditEnd = () => {
    const { store } = app.value;
    store.dispatch(editTableEndAction());
  };

  const handleInput = (event: InputEvent, focusType: FocusType) => {
    const { store } = app.value;
    const input = event.target as HTMLInputElement | null;
    if (!input) return;

    store.dispatch(
      changeColumnValueAction$(
        focusType,
        props.column.tableId,
        props.column.id,
        input.value
      )
    );
  };

  const handleMouseenterKey = () => {
    const { column } = props;
    if (column.ui.keys === 0) return;

    const { store } = app.value;
    store.dispatch(columnKeyHoverStartAction$(column.id));
  };

  const handleMouseleaveKey = () => {
    const { store } = app.value;
    store.dispatch(columnKeyHoverEndAction$());
  };

  const getColumnOrder = (): ColumnOrderTpl[] => {
    const { store } = app.value;
    const { settings } = store.state;
    const { column, widthName, widthDataType, widthDefault, widthComment } =
      props;

    return settings.columnOrder
      .map((columnType: number) => {
        let template: DOMTemplateLiterals | null = null;

        switch (columnType) {
          case ColumnType.columnName:
            template = (
              <div
                class="column-col"
                data-type="columnName"
                bool:data-shared-focus={Boolean(props.sharedFocusName)}
                style={{ '--shared-focus': props.sharedFocusName ?? '' }}
                on:mousedown={(event: MouseEvent) => {
                  handleFocus(event, FocusType.columnName);
                }}
                on:dblclick={() => {
                  handleEdit(FocusType.columnName);
                }}
              >
                <EditInput
                  placeholder="column"
                  width={widthName}
                  value={column.name}
                  focus={props.focusName}
                  edit={props.editName}
                  autofocus={true}
                  onBlur={handleEditEnd}
                  onInput={(event: InputEvent) => {
                    handleInput(event, FocusType.columnName);
                  }}
                />
              </div>
            );
            break;
          case ColumnType.columnDefault:
            template = bHas(settings.show, Show.columnDefault) ? (
              <div
                class="column-col"
                data-type="columnDefault"
                bool:data-shared-focus={Boolean(props.sharedFocusDefault)}
                style={{ '--shared-focus': props.sharedFocusDefault ?? '' }}
                on:mousedown={(event: MouseEvent) => {
                  handleFocus(event, FocusType.columnDefault);
                }}
                on:dblclick={() => {
                  handleEdit(FocusType.columnDefault);
                }}
              >
                <EditInput
                  placeholder="default"
                  width={widthDefault}
                  value={column.default}
                  focus={props.focusDefault}
                  edit={props.editDefault}
                  autofocus={true}
                  onBlur={handleEditEnd}
                  onInput={(event: InputEvent) => {
                    handleInput(event, FocusType.columnDefault);
                  }}
                />
              </div>
            ) : null;
            break;
          case ColumnType.columnComment:
            template = bHas(settings.show, Show.columnComment) ? (
              <div
                class="column-col"
                data-type="columnComment"
                bool:data-shared-focus={Boolean(props.sharedFocusComment)}
                style={{ '--shared-focus': props.sharedFocusComment ?? '' }}
                on:mousedown={(event: MouseEvent) => {
                  handleFocus(event, FocusType.columnComment);
                }}
                on:dblclick={() => {
                  handleEdit(FocusType.columnComment);
                }}
              >
                <EditInput
                  title={column.comment}
                  placeholder="comment"
                  width={widthComment}
                  value={column.comment}
                  focus={props.focusComment}
                  edit={props.editComment}
                  autofocus={true}
                  onBlur={handleEditEnd}
                  onInput={(event: InputEvent) => {
                    handleInput(event, FocusType.columnComment);
                  }}
                />
              </div>
            ) : null;
            break;
          case ColumnType.columnDataType:
            template = bHas(settings.show, Show.columnDataType) ? (
              <div
                class="column-col"
                data-type="columnDataType"
                bool:data-shared-focus={Boolean(props.sharedFocusDataType)}
                style={{ '--shared-focus': props.sharedFocusDataType ?? '' }}
                on:mousedown={(event: MouseEvent) => {
                  handleFocus(event, FocusType.columnDataType);
                }}
                on:dblclick={() => {
                  handleEdit(FocusType.columnDataType);
                }}
              >
                <ColumnDataType
                  app={app}
                  tableId={column.tableId}
                  columnId={column.id}
                  width={widthDataType}
                  value={column.dataType}
                  focus={props.focusDataType}
                  edit={props.editDataType}
                  onBlur={handleEditEnd}
                  onEditEnd={handleEditEnd}
                  onInput={(event: InputEvent) => {
                    handleInput(event, FocusType.columnDataType);
                  }}
                />
              </div>
            ) : null;
            break;
          case ColumnType.columnNotNull:
            template = bHas(settings.show, Show.columnNotNull) ? (
              <div
                class="column-col"
                data-type="columnNotNull"
                bool:data-shared-focus={Boolean(props.sharedFocusNotNull)}
                style={{ '--shared-focus': props.sharedFocusNotNull ?? '' }}
                on:mousedown={(event: MouseEvent) => {
                  handleFocus(event, FocusType.columnNotNull);
                }}
                on:dblclick={() => {
                  handleEdit(FocusType.columnNotNull);
                }}
              >
                <ColumnNotNull
                  options={column.options}
                  focus={props.focusNotNull}
                />
              </div>
            ) : null;
            break;
          case ColumnType.columnUnique:
            template = bHas(settings.show, Show.columnUnique) ? (
              <div
                class="column-col"
                data-type="columnUnique"
                bool:data-shared-focus={Boolean(props.sharedFocusUnique)}
                style={{ '--shared-focus': props.sharedFocusUnique ?? '' }}
                on:mousedown={(event: MouseEvent) => {
                  handleFocus(event, FocusType.columnUnique);
                }}
                on:dblclick={() => {
                  handleEdit(FocusType.columnUnique);
                }}
              >
                <ColumnOption
                  checked={bHas(column.options, ColumnOptionType.unique)}
                  width={COLUMN_UNIQUE_WIDTH}
                  text="UQ"
                  title="Unique"
                  focus={props.focusUnique}
                />
              </div>
            ) : null;
            break;
          case ColumnType.columnAutoIncrement:
            template = bHas(settings.show, Show.columnAutoIncrement) ? (
              <div
                class="column-col"
                data-type="columnAutoIncrement"
                bool:data-shared-focus={Boolean(props.sharedFocusAutoIncrement)}
                style={{
                  '--shared-focus': props.sharedFocusAutoIncrement ?? '',
                }}
                on:mousedown={(event: MouseEvent) => {
                  handleFocus(event, FocusType.columnAutoIncrement);
                }}
                on:dblclick={() => {
                  handleEdit(FocusType.columnAutoIncrement);
                }}
              >
                <ColumnOption
                  checked={bHas(column.options, ColumnOptionType.autoIncrement)}
                  width={COLUMN_AUTO_INCREMENT_WIDTH}
                  text="AI"
                  title="Auto Increment"
                  focus={props.focusAutoIncrement}
                />
              </div>
            ) : null;
            break;
        }

        return {
          columnType,
          template,
        };
      })
      .filter(({ template }) => Boolean(template));
  };

  return () => {
    const { store, keyBindingMap } = app.value;
    const { editor } = store.state;
    const { column, selected } = props;
    const hover = Boolean(editor.hoverColumnMap[column.id]);
    const dragging = editor.draggingColumnMap[column.id];

    return (
      <div
        class={['column-row', styles.root]}
        data-id={column.id}
        data-table-id={column.tableId}
        bool:data-selected={selected}
        bool:data-hover={hover}
        bool:data-dragging={dragging}
        bool:data-ghost={props.ghost}
        draggable={props.draggable ? 'true' : 'false'}
        on:dragstart={props.onDragstart}
        on:dragend={props.onDragend}
      >
        <ColumnKey
          keys={column.ui.keys}
          onMouseenter={handleMouseenterKey}
          onMouseleave={handleMouseleaveKey}
        />
        {repeat(
          getColumnOrder(),
          ({ columnType }) => columnType,
          ({ template }) => template
        )}
        <Icon
          class={styles.iconButton}
          size={12}
          name="x"
          title={simpleShortcutToString(
            keyBindingMap.removeColumn[0]?.shortcut
          )}
          onClick={handleRemoveColumn}
        />
      </div>
    );
  };
};

export default Column;

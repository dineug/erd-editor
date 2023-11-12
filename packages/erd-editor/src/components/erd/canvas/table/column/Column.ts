import { DOMTemplateLiterals, FC, html, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
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
import { FocusType } from '@/engine/modules/editor/state';
import {
  changeColumnValueAction$,
  isToggleColumnTypes,
  removeColumnAction$,
  toggleColumnValueAction$,
} from '@/engine/modules/tableColumn/generator.actions';
import { Column } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { isMod, simpleShortcutToString } from '@/utils/keyboard-shortcut';

import * as styles from './Column.styles';

export type ColumnProps = {
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
  editName: boolean;
  editDataType: boolean;
  editDefault: boolean;
  editComment: boolean;
};

type ColumnOrderTpl = {
  columnType: number;
  template: DOMTemplateLiterals | null;
};

const Column: FC<ColumnProps> = (props, ctx) => {
  const app = useAppContext(ctx);

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
            template = html`
              <div
                class="column-col"
                @mousedown=${(event: MouseEvent) => {
                  handleFocus(event, FocusType.columnName);
                }}
                @dblclick=${() => {
                  handleEdit(FocusType.columnName);
                }}
              >
                <${EditInput}
                  placeholder="column"
                  width=${widthName}
                  value=${column.name}
                  focus=${props.focusName}
                  edit=${props.editName}
                  autofocus=${true}
                  .onBlur=${handleEditEnd}
                  .onInput=${(event: InputEvent) => {
                    handleInput(event, FocusType.columnName);
                  }}
                />
              </div>
            `;
            break;
          case ColumnType.columnDefault:
            template = bHas(settings.show, Show.columnDefault)
              ? html`
                  <div
                    class="column-col"
                    @mousedown=${(event: MouseEvent) => {
                      handleFocus(event, FocusType.columnDefault);
                    }}
                    @dblclick=${() => {
                      handleEdit(FocusType.columnDefault);
                    }}
                  >
                    <${EditInput}
                      placeholder="default"
                      width=${widthDefault}
                      value=${column.default}
                      focus=${props.focusDefault}
                      edit=${props.editDefault}
                      autofocus=${true}
                      .onBlur=${handleEditEnd}
                      .onInput=${(event: InputEvent) => {
                        handleInput(event, FocusType.columnDefault);
                      }}
                    />
                  </div>
                `
              : null;
            break;
          case ColumnType.columnComment:
            template = bHas(settings.show, Show.columnComment)
              ? html`
                  <div
                    class="column-col"
                    @mousedown=${(event: MouseEvent) => {
                      handleFocus(event, FocusType.columnComment);
                    }}
                    @dblclick=${() => {
                      handleEdit(FocusType.columnComment);
                    }}
                  >
                    <${EditInput}
                      placeholder="comment"
                      width=${widthComment}
                      value=${column.comment}
                      focus=${props.focusComment}
                      edit=${props.editComment}
                      autofocus=${true}
                      .onBlur=${handleEditEnd}
                      .onInput=${(event: InputEvent) => {
                        handleInput(event, FocusType.columnComment);
                      }}
                    />
                  </div>
                `
              : null;
            break;
          case ColumnType.columnDataType:
            template = bHas(settings.show, Show.columnDataType)
              ? html`
                  <div
                    class="column-col"
                    @mousedown=${(event: MouseEvent) => {
                      handleFocus(event, FocusType.columnDataType);
                    }}
                    @dblclick=${() => {
                      handleEdit(FocusType.columnDataType);
                    }}
                  >
                    <${EditInput}
                      placeholder="dataType"
                      width=${widthDataType}
                      value=${column.dataType}
                      focus=${props.focusDataType}
                      edit=${props.editDataType}
                      autofocus=${true}
                      .onBlur=${handleEditEnd}
                      .onInput=${(event: InputEvent) => {
                        handleInput(event, FocusType.columnDataType);
                      }}
                    />
                  </div>
                `
              : null;
            break;
          case ColumnType.columnNotNull:
            template = bHas(settings.show, Show.columnNotNull)
              ? html`
                  <div
                    class="column-col"
                    @mousedown=${(event: MouseEvent) => {
                      handleFocus(event, FocusType.columnNotNull);
                    }}
                    @dblclick=${() => {
                      handleEdit(FocusType.columnNotNull);
                    }}
                  >
                    <${ColumnNotNull}
                      options=${column.options}
                      focus=${props.focusNotNull}
                    />
                  </div>
                `
              : null;
            break;
          case ColumnType.columnUnique:
            template = bHas(settings.show, Show.columnUnique)
              ? html`
                  <div
                    class="column-col"
                    @mousedown=${(event: MouseEvent) => {
                      handleFocus(event, FocusType.columnUnique);
                    }}
                    @dblclick=${() => {
                      handleEdit(FocusType.columnUnique);
                    }}
                  >
                    <${ColumnOption}
                      checked=${bHas(column.options, ColumnOptionType.unique)}
                      width=${COLUMN_UNIQUE_WIDTH}
                      text="UQ"
                      title="Unique"
                      focus=${props.focusUnique}
                    />
                  </div>
                `
              : null;
            break;
          case ColumnType.columnAutoIncrement:
            template = bHas(settings.show, Show.columnAutoIncrement)
              ? html`
                  <div
                    class="column-col"
                    @mousedown=${(event: MouseEvent) => {
                      handleFocus(event, FocusType.columnAutoIncrement);
                    }}
                    @dblclick=${() => {
                      handleEdit(FocusType.columnAutoIncrement);
                    }}
                  >
                    <${ColumnOption}
                      checked=${bHas(
                        column.options,
                        ColumnOptionType.autoIncrement
                      )}
                      width=${COLUMN_AUTO_INCREMENT_WIDTH}
                      text="AI"
                      title="Auto Increment"
                      focus=${props.focusAutoIncrement}
                    />
                  </div>
                `
              : null;
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
    const { keyBindingMap } = app.value;
    const { column, selected } = props;

    return html`
      <div class=${['column-row', styles.root, { selected }]}>
        <${ColumnKey} keys=${column.ui.keys} />
        ${repeat(
          getColumnOrder(),
          ({ columnType }) => columnType,
          ({ template }) => template
        )}
        <${Icon}
          class=${styles.iconButton}
          size=${12}
          name="xmark"
          title=${simpleShortcutToString(
            keyBindingMap.removeColumn[0]?.shortcut
          )}
          .onClick=${handleRemoveColumn}
        />
      </div>
    `;
  };
};

export default Column;

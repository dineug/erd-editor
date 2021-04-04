import { ColumnType } from '@@types/engine/store/canvas.state';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { html, TemplateResult } from '@dineug/lit-observable';
import { repeat } from 'lit-html/directives/repeat';
import { ColumnProps } from './Column';
import {
  changeColumnName,
  changeColumnComment,
  changeColumnDataType,
  changeColumnDefault,
  changeColumnNotNull,
  changeColumnUnique,
  changeColumnAutoIncrement,
} from '@/engine/command/column.cmd.helper';
import {
  focusColumn,
  editTableEnd,
  editTable,
} from '@/engine/command/editor.cmd.helper';

interface ReshapeColumn {
  columnType: ColumnType;
  template: TemplateResult;
}

const changeColumnMap = {
  columnName: changeColumnName,
  columnComment: changeColumnComment,
  columnDataType: changeColumnDataType,
  columnDefault: changeColumnDefault,
};

const changeColumnBooleanMap = {
  columnNotNull: changeColumnNotNull,
  columnUnique: changeColumnUnique,
  columnAutoIncrement: changeColumnAutoIncrement,
};

const changeColumnBooleanKeys: ColumnType[] = [
  'columnNotNull',
  'columnUnique',
  'columnAutoIncrement',
];

export function columnTpl(
  props: ColumnProps,
  { store, helper }: IERDEditorContext
) {
  const {
    canvasState: { show, setting },
  } = store;
  const { column } = props;
  const { ui } = column;

  const onInput = (event: Event, columnType: ColumnType) => {
    const changeColumn = (changeColumnMap as any)[columnType];
    if (!changeColumn) return;

    const input = event.target as HTMLInputElement;

    store.dispatch(
      changeColumn(helper, props.tableId, props.column.id, input.value)
    );
  };

  const onFocus = (event: MouseEvent, columnType: ColumnType) => {
    store.dispatch(
      focusColumn(
        props.tableId,
        props.column.id,
        columnType,
        event.ctrlKey || event.metaKey,
        event.shiftKey
      )
    );
  };

  const onBlur = () => {
    store.dispatch(editTableEnd());
  };

  const onEdit = (columnType: ColumnType) => {
    if (changeColumnBooleanKeys.includes(columnType)) {
      const changeColumn = (changeColumnBooleanMap as any)[columnType];

      store.dispatch(changeColumn(store, props.tableId, props.column.id));
    } else {
      store.dispatch(editTable());
    }
  };

  const reshapeColumns = setting.columnOrder
    .map<ReshapeColumn | null>(columnType => {
      switch (columnType) {
        case 'columnName':
          return {
            columnType,
            template: html`
              <vuerd-input
                .width=${props.widthName}
                .value=${column.name}
                .active=${ui.active}
                .select=${props.select}
                .focusState=${props.focusName}
                .edit=${props.editName}
                placeholder="column"
                @vuerd-input-blur=${onBlur}
                @input=${(event: Event) => onInput(event, 'columnName')}
                @mousedown=${(event: MouseEvent) =>
                  onFocus(event, 'columnName')}
                @dblclick=${() => onEdit('columnName')}
              ></vuerd-input>
            `,
          };

        case 'columnDefault':
          return show.columnDefault
            ? {
                columnType,
                template: html`
                  <vuerd-input
                    .width=${props.widthDefault}
                    .value=${column.default}
                    .active=${ui.active}
                    .select=${props.select}
                    .focusState=${props.focusDefault}
                    .edit=${props.editDefault}
                    placeholder="default"
                    @vuerd-input-blur=${onBlur}
                    @input=${(event: Event) => onInput(event, 'columnDefault')}
                    @mousedown=${(event: MouseEvent) =>
                      onFocus(event, 'columnDefault')}
                    @dblclick=${() => onEdit('columnDefault')}
                  ></vuerd-input>
                `,
              }
            : null;

        case 'columnComment':
          return show.columnComment
            ? {
                columnType,
                template: html`
                  <vuerd-input
                    class="vuerd-column-comment"
                    .width=${props.widthComment}
                    .value=${column.comment}
                    .active=${ui.active}
                    .select=${props.select}
                    .edit=${props.editComment}
                    .focusState=${props.focusComment}
                    placeholder="comment"
                    data-tippy-content=${column.comment.trim()
                      ? column.comment
                      : 'comment'}
                    @vuerd-input-blur=${onBlur}
                    @input=${(event: Event) => onInput(event, 'columnComment')}
                    @mousedown=${(event: MouseEvent) =>
                      onFocus(event, 'columnComment')}
                    @dblclick=${() => onEdit('columnComment')}
                  ></vuerd-input>
                `,
              }
            : null;

        case 'columnDataType':
          return show.columnDataType
            ? {
                columnType,
                template: html`
                  <vuerd-column-data-type
                    .width=${props.widthDataType}
                    .value=${column.dataType}
                    .active=${ui.active}
                    .tableId=${props.tableId}
                    .columnId=${column.id}
                    .select=${props.select}
                    .focusState=${props.focusDataType}
                    .edit=${props.editDataType}
                    @vuerd-input-blur=${onBlur}
                    @input=${(event: Event) => onInput(event, 'columnDataType')}
                    @mousedown=${(event: MouseEvent) =>
                      onFocus(event, 'columnDataType')}
                    @dblclick=${() => onEdit('columnDataType')}
                  ></vuerd-column-data-type>
                `,
              }
            : null;

        case 'columnNotNull':
          return show.columnNotNull
            ? {
                columnType,
                template: html`
                  <vuerd-column-not-null
                    .columnOption=${column.option}
                    .focusState=${props.focusNotNull}
                    @mousedown=${(event: MouseEvent) =>
                      onFocus(event, 'columnNotNull')}
                    @dblclick=${() => onEdit('columnNotNull')}
                  ></vuerd-column-not-null>
                `,
              }
            : null;

        case 'columnUnique':
          return show.columnUnique
            ? {
                columnType,
                template: html`
                  <vuerd-column-unique
                    .columnOption=${column.option}
                    .focusState=${props.focusUnique}
                    @mousedown=${(event: MouseEvent) =>
                      onFocus(event, 'columnUnique')}
                    @dblclick=${() => onEdit('columnUnique')}
                  ></vuerd-column-unique>
                `,
              }
            : null;

        case 'columnAutoIncrement':
          return show.columnAutoIncrement
            ? {
                columnType,
                template: html`
                  <vuerd-column-auto-increment
                    .columnOption=${column.option}
                    .focusState=${props.focusAutoIncrement}
                    @mousedown=${(event: MouseEvent) =>
                      onFocus(event, 'columnAutoIncrement')}
                    @dblclick=${() => onEdit('columnAutoIncrement')}
                  ></vuerd-column-auto-increment>
                `,
              }
            : null;

        default:
          return null;
      }
    })
    .filter(reshapeColumn => !!reshapeColumn) as ReshapeColumn[];

  return repeat(
    reshapeColumns,
    reshapeColumn => reshapeColumn.columnType,
    reshapeColumn => reshapeColumn.template
  );
}

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
} from '@/engine/command/column.cmd.helper';
import { isFocus, isSelectColumn } from '@/engine/store/editor.helper';

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

export function columnTpl(
  props: ColumnProps,
  { store, helper }: IERDEditorContext
) {
  const {
    canvasState: { show, setting },
    editorState,
  } = store;
  const column = props.column;
  const { ui } = column;

  const onInput = (event: Event, columnType: ColumnType) => {
    const changeColumn = (changeColumnMap as any)[columnType];
    if (!changeColumn) return;

    const input = event.target as HTMLInputElement;

    store.dispatch(
      changeColumn(helper, props.tableId, props.column.id, input.value)
    );
  };

  const onBlur = () => {
    // store.dispatch(editTableEnd());
  };

  const reshapeColumns = setting.columnOrder
    .map<ReshapeColumn | null>(columnType => {
      switch (columnType) {
        case 'columnName':
          return {
            columnType,
            template: html`
              <vuerd-input
                .width=${ui.widthName}
                .value=${column.name}
                .active=${ui.active}
                .select=${isSelectColumn(editorState.focusTable, column.id)}
                .focusState=${isFocus(
                  editorState.focusTable,
                  'columnName',
                  props.tableId,
                  column.id
                )}
                placeholder="column"
                @blur=${onBlur}
                @input=${(event: Event) => onInput(event, 'columnName')}
              ></vuerd-input>
            `,
          };

        case 'columnDefault':
          return show.columnDefault
            ? {
                columnType,
                template: html`
                  <vuerd-input
                    .width=${ui.widthDefault}
                    .value=${column.default}
                    .active=${ui.active}
                    .select=${isSelectColumn(editorState.focusTable, column.id)}
                    .focusState=${isFocus(
                      editorState.focusTable,
                      'columnDefault',
                      props.tableId,
                      column.id
                    )}
                    placeholder="default"
                    @blur=${onBlur}
                    @input=${(event: Event) => onInput(event, 'columnDefault')}
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
                    .width=${ui.widthComment}
                    .value=${column.comment}
                    .active=${ui.active}
                    .select=${isSelectColumn(editorState.focusTable, column.id)}
                    .focusState=${isFocus(
                      editorState.focusTable,
                      'columnComment',
                      props.tableId,
                      column.id
                    )}
                    placeholder="comment"
                    @blur=${onBlur}
                    @input=${(event: Event) => onInput(event, 'columnComment')}
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
                    .width=${ui.widthDataType}
                    .value=${column.dataType}
                    .active=${ui.active}
                    .tableId=${props.tableId}
                    .columnId=${column.id}
                    .select=${isSelectColumn(editorState.focusTable, column.id)}
                    .focusState=${isFocus(
                      editorState.focusTable,
                      'columnDataType',
                      props.tableId,
                      column.id
                    )}
                    @blur=${onBlur}
                    @input=${(event: Event) => onInput(event, 'columnDataType')}
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
                    .focusState=${isFocus(
                      editorState.focusTable,
                      'columnNotNull',
                      props.tableId,
                      column.id
                    )}
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
                    .focusState=${isFocus(
                      editorState.focusTable,
                      'columnUnique',
                      props.tableId,
                      column.id
                    )}
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
                    .focusState=${isFocus(
                      editorState.focusTable,
                      'columnAutoIncrement',
                      props.tableId,
                      column.id
                    )}
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

import { ColumnType } from '@@types/engine/store/canvas.state';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { html, TemplateResult } from '@dineug/lit-observable';
import { ColumnProps } from './Column';
import {
  changeColumnName,
  changeColumnComment,
  changeColumnDataType,
  changeColumnDefault,
} from '@/engine/command/column.cmd.helper';

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

  return setting.columnOrder
    .map(columnType => {
      switch (columnType) {
        case 'columnName':
          return html`
            <vuerd-input
              .width=${ui.widthName}
              .value=${column.name}
              .active=${ui.active}
              placeholder="column"
              @blur=${onBlur}
              @input=${(event: Event) => onInput(event, 'columnName')}
            ></vuerd-input>
          `;
        case 'columnDataType':
          return show.columnDataType
            ? html`
                <vuerd-column-data-type
                  .width=${ui.widthDataType}
                  .value=${column.dataType}
                  .active=${ui.active}
                  .tableId=${props.tableId}
                  .columnId=${column.id}
                  @blur=${onBlur}
                  @input=${(event: Event) => onInput(event, 'columnDataType')}
                ></vuerd-column-data-type>
              `
            : null;
        default:
          return null;
      }
    })
    .filter(template => !!template) as TemplateResult[];
}

import './Column';

import {
  defineComponent,
  FunctionalComponent,
  html,
} from '@vuerd/lit-observable';
import { repeat } from 'lit-html/directives/repeat';
import { styleMap } from 'lit-html/directives/style-map';

import { SIZE_TABLE_PADDING } from '@/core/layout';
import { useAPI } from '@/extensions/panels/visualization/hooks/api.hook';
import { Table } from '@@types/engine/store/table.state';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-visualization-table': VisualizationTableElement;
  }
}

export interface VisualizationTableProps {
  table: Table;
  columnId: string | null;
  top: number;
  left: number;
}

export interface VisualizationTableElement
  extends VisualizationTableProps,
    HTMLElement {}

const VisualizationTable: FunctionalComponent<
  VisualizationTableProps,
  VisualizationTableElement
> = (props, ctx) => {
  const apiRef = useAPI(ctx);

  return () => {
    const { show } = apiRef.value.store.canvasState;
    const { table } = props;
    const widthColumn = table.maxWidthColumn();

    return html`
      <div
        class="vuerd-table"
        style=${styleMap({
          top: `${props.top}px`,
          left: `${props.left}px`,
          width: `${table.width()}px`,
          height: `${table.height()}px`,
          position: 'fixed',
        })}
      >
        <div class="vuerd-table-header">
          <div class="vuerd-table-header-top">
            <div
              class="vuerd-table-header-color"
              style=${styleMap({
                width: `${table.width() + SIZE_TABLE_PADDING * 2}px`,
                backgroundColor: table.ui.color ?? '',
              })}
            ></div>
          </div>
          <div class="vuerd-table-header-body">
            <vuerd-input
              class="vuerd-table-name"
              .width=${table.ui.widthName}
              .value=${table.name}
              placeholder="table"
            ></vuerd-input>
            ${show.tableComment
              ? html`
                  <vuerd-input
                    class="vuerd-table-comment"
                    .width=${table.ui.widthComment}
                    .value=${table.comment}
                    placeholder="comment"
                  ></vuerd-input>
                `
              : null}
          </div>
        </div>
        <div class="vuerd-table-body">
          ${repeat(
            props.table.columns,
            column => column.id,
            column =>
              html`
                <vuerd-visualization-column
                  .column=${column}
                  .active=${props.columnId === column.id}
                  .widthName=${widthColumn.name}
                  .widthDataType=${widthColumn.dataType}
                  .widthNotNull=${widthColumn.notNull}
                  .widthDefault=${widthColumn.default}
                  .widthComment=${widthColumn.comment}
                ></vuerd-visualization-column>
              `
          )}
        </div>
      </div>
    `;
  };
};

defineComponent('vuerd-visualization-table', {
  observedProps: ['table', 'columnId', 'top', 'left'],
  shadow: false,
  render: VisualizationTable,
});

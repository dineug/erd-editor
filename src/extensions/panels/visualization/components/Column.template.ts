import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { ColumnType } from '@@types/engine/store/canvas.state';
import { html, TemplateResult } from '@dineug/lit-observable';
import { repeat } from 'lit-html/directives/repeat';
import { VisualizationColumnProps } from './Column';

interface ReshapeColumn {
  columnType: ColumnType;
  template: TemplateResult;
}

export function columnTpl(
  props: VisualizationColumnProps,
  {
    store: {
      canvasState: { show, setting },
    },
  }: ERDEditorContext
) {
  const { column } = props;

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
                .active=${props.active}
                placeholder="column"
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
                    .active=${props.active}
                    placeholder="default"
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
                    .width=${props.widthComment}
                    .value=${column.comment}
                    .active=${props.active}
                    placeholder="comment"
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
                    .active=${props.active}
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

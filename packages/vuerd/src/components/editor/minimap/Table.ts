import { Table } from '@@types/engine/store/table.state';
import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@vuerd/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-minimap-table': MinimapTableElement;
  }
}

export interface MinimapTableProps {
  table: Table;
}

export interface MinimapTableElement extends MinimapTableProps, HTMLElement {}

const MinimapTable: FunctionalComponent<
  MinimapTableProps,
  MinimapTableElement
> = (props, ctx) => () => {
  const { table } = props;
  const { ui } = table;
  table.maxWidthColumn();

  return html`
    <div
      class="vuerd-table"
      style=${styleMap({
        top: `${ui.top}px`,
        left: `${ui.left}px`,
        zIndex: `${ui.zIndex}`,
        width: `${table.width()}px`,
        height: `${table.height()}px`,
      })}
    ></div>
  `;
};

defineComponent('vuerd-minimap-table', {
  observedProps: ['table'],
  shadow: false,
  render: MinimapTable,
});

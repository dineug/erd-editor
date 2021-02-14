import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { repeat } from 'lit-html/directives/repeat';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-table': TableElement;
  }
}

export interface TableProps {}

export interface TableElement extends TableProps, HTMLElement {}

const Table: FunctionalComponent<TableProps, TableElement> = (props, ctx) => {
  return () => html`<div class="vuerd-table"></div>`;
};

defineComponent('vuerd-table', {
  render: Table,
});

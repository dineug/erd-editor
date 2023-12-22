import {
  defineComponent,
  getContext,
  html,
  ProviderElement,
} from '@vuerd/lit-observable';

import { GridContext } from '@/extensions/panels/grid/core/gridContext';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-grid-editor-provider': GridEditorProviderElement;
  }
}

export interface GridEditorProviderElement
  extends ProviderElement<GridContext> {}

defineComponent('vuerd-grid-editor-provider', {
  render: (_, ctx: GridEditorProviderElement) => () => html`<slot></slot>`,
});

export const getGridContext = (ctx: Element) =>
  getContext<GridContext>('vuerd-grid-editor-provider', ctx);

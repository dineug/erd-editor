import {
  defineComponent,
  html,
  ProviderElement,
  getContext,
} from '@dineug/lit-observable';
import { GridContext } from '@/extensions/panels/grid/GridContext';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-grid-provider': GridProviderElement;
  }
}

export interface GridProviderElement extends ProviderElement<GridContext> {}

defineComponent('vuerd-grid-provider', {
  render: (_, ctx: GridProviderElement) => () => html`<slot></slot>`,
});

export const getGridContext = (ctx: Element) =>
  getContext<GridContext>('vuerd-grid-provider', ctx);

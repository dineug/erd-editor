import { defineCustomElement, FC, html, ProviderElement } from '@dineug/r-html';

import { AppContext } from '@/components/context';

declare global {
  interface HTMLElementTagNameMap {
    'r-erd-provider': ERDProviderElement;
  }
}

export interface ERDProviderElement extends ProviderElement<AppContext> {}

const ERDProvider: FC<{}, ERDProviderElement> = (props, ctx) => {
  return () => html`<slot></slot>`;
};

defineCustomElement('r-erd-provider', {
  render: ERDProvider,
});

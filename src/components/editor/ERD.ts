import { defineComponent, html } from '@dineug/lit-observable';
import { ERDStyle } from './ERD.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-erd': ERDElement;
  }
}

export interface ERDProps {}

export interface ERDElement extends ERDProps, HTMLElement {}

defineComponent('vuerd-erd', {
  style: ERDStyle,
  styleMap: {
    height: '100%',
  },
  render(props: ERDProps, ctx: ERDElement) {
    return () => html`<div class="vuerd-erd">vuerd-erd</div>`;
  },
});

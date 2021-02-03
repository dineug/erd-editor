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
  render(props: ERDProps, ctx: ERDElement) {
    ctx.style.height = '100%';
    return () => html`<div class="vuerd-erd">vuerd-erd</div>`;
  },
});

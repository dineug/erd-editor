import { defineComponent, html } from '@dineug/lit-observable';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-erd': ERDElement;
  }
}

export interface ERDProps {}

export interface ERDElement extends ERDProps, HTMLElement {}

defineComponent('vuerd-erd', {
  render(props: ERDProps, ctx: ERDElement) {
    return () => html`<div>vuerd-erd</div>`;
  },
});

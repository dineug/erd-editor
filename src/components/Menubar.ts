import { defineComponent, html } from '@dineug/lit-observable';
import { menubarStyle } from './Menubar.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-menubar': MenubarElement;
  }
}

export interface MenubarProps {}

export interface MenubarElement extends MenubarProps, HTMLElement {}

defineComponent('vuerd-menubar', {
  style: menubarStyle,
  render(props: MenubarProps, ctx: MenubarElement) {
    return () => html`<div class="vuerd-menubar"></div>`;
  },
});

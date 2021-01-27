import { ERDEditorContext } from '@type/core/ERDEditorContext';
import { ThemeKey } from '@type/core/theme';
import {
  defineComponent,
  html,
  ProviderElement,
  getContext,
} from '@dineug/lit-observable';
import kebabCase from 'lodash/kebabCase';
import { createdERDEditorContext } from '@/core/ERDEditorContext';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-provider': ERDEditorProviderElement;
  }
}

export interface ERDEditorProviderElement
  extends ProviderElement<ERDEditorContext> {}

defineComponent('vuerd-provider', {
  render(_, ctx: ERDEditorProviderElement) {
    const context = createdERDEditorContext();
    const { theme } = context;

    ctx.value = context;

    return () => {
      const themeToString = Object.keys(theme)
        .map(
          key =>
            `--vuerd-color-${kebabCase(key)}: var(--vuerd-theme-${kebabCase(
              key
            )}, ${theme[key as ThemeKey]});`
        )
        .join('');

      return html`
        <style type="text/css">
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap');
          :host {
            --vuerd-font-family: 'Noto Sans', sans-serif;
            ${themeToString}
          }
        </style>
        <slot></slot>
      `;
    };
  },
});

export const getVuerdContext = (el: Element) =>
  getContext<ERDEditorContext>('vuerd-provider', el);

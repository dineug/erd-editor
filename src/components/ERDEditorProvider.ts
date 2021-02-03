import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import {
  defineComponent,
  html,
  ProviderElement,
  getContext,
  beforeMount,
} from '@dineug/lit-observable';
import { themeToString } from '@/core/theme';
import { SIZE_FONT } from '@/core/layout';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-provider': ERDEditorProviderElement;
  }
}

export interface ERDEditorProviderElement
  extends ProviderElement<ERDEditorContext> {}

defineComponent('vuerd-provider', {
  render: (_, ctx: ERDEditorProviderElement) => () => html`
    <style type="text/css">
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap');
      :host {
        --vuerd-font-family: 'Noto Sans', sans-serif;
        font-size: ${SIZE_FONT}px;
        font-family: var(--vuerd-font-family) !important;
        ${themeToString(ctx.value.theme)}
      }
    </style>
    <slot></slot>
  `,
});

export const getVuerdContext = (ctx: Element) =>
  getContext<ERDEditorContext>('vuerd-provider', ctx);

export function getVuerdContextRef(ctx: Element) {
  const ref: { value: ERDEditorContext | null } = { value: null };

  beforeMount(() => (ref.value = getVuerdContext(ctx)));

  return ref as { value: ERDEditorContext };
}

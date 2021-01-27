import { ERDEditorContext } from '@type/core/ERDEditorContext';
import {
  defineComponent,
  html,
  ProviderElement,
  getContext,
} from '@dineug/lit-observable';
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
    ctx.value = createdERDEditorContext();
    return () => html`<slot></slot>`;
  },
});

export const getVuerdContext = (el: Element) =>
  getContext<ERDEditorContext>('vuerd-provider', el);

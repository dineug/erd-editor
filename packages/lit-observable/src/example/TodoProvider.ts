import { beforeMount, defineComponent, getContext, html } from '@/core';
import { ProviderElement } from '@@types/context';

import { Store } from './Store';

declare global {
  interface HTMLElementTagNameMap {
    'todo-provider': TodoProviderElement;
  }
}

export interface TodoProviderElement extends ProviderElement<Store> {}

defineComponent('todo-provider', {
  render: () => () => html`<slot></slot>`,
});

export const getTodoContext = (el: Element) =>
  getContext<Store>('todo-provider', el);

export function getTodoContextRef(ctx: Element) {
  const ref: { value: Store | null } = { value: null };

  beforeMount(() => (ref.value = getTodoContext(ctx)));

  return ref as { value: Store };
}

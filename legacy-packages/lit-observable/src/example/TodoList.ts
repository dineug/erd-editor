import './TodoItem';

import { defineComponent, html } from '@/core';

import { getTodoContextRef } from './TodoProvider';

declare global {
  interface HTMLElementTagNameMap {
    'todo-list': TodoListElement;
  }
}

interface TodoListElement extends HTMLElement {}

defineComponent('todo-list', {
  render(_, ctx: TodoListElement) {
    const storeRef = getTodoContextRef(ctx);

    return () => html`
      <ul>
        ${storeRef.value.list.map(
          todo => html`<todo-item .todo=${todo}></todo-item>`
        )}
      </ul>
    `;
  },
});

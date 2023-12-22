import './TodoList';

import { defineComponent, html } from '@/core';

import { Store } from './Store';

declare global {
  interface HTMLElementTagNameMap {
    'my-todo': MyTodoElement;
  }
}

interface MyTodoElement extends HTMLElement {}

defineComponent('my-todo', {
  shadow: 'closed',
  render() {
    const store = new Store();
    const add = () => store.add({ name: `${Math.random()}` });

    return () => html`
      <todo-provider .value=${store}>
        <button @click=${add}>add</button>
        <todo-list></todo-list>
      </todo-provider>
    `;
  },
});

import { html, defineComponent } from '@/core';
import { Todo } from './Store';

declare global {
  interface HTMLElementTagNameMap {
    'todo-item': TodoItemElement;
  }
}

interface TodoItemProps {
  todo: Todo;
}

interface TodoItemElement extends TodoItemProps, HTMLElement {}

defineComponent('todo-item', {
  observedProps: ['todo'],
  render: (props: TodoItemProps) => () => html`<li>${props.todo.name}</li>`,
});

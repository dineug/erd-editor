import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-find': FindElement;
  }
}

export interface FindProps {}

export interface FindElement extends FindProps, HTMLElement {}

const Find: FunctionalComponent<FindProps, FindElement> = (props, ctx) => {
  return () => html``;
};

defineComponent('vuerd-find', {
  render: Find,
});

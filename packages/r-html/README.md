# r-html - Tagged templates framework

```ts
import {
  css,
  defineCustomElement,
  FC,
  html,
  observable,
  render,
} from '@dineug/r-html';

const incrementBtn = css`
  color: green;
`;
const decrementBtn = css`
  color: red;
`;

const Counter: FC = () => {
  const state = observable({ count: 0 });

  return () => html`
    <div>Counter: ${state.count}</div>
    <button class=${incrementBtn} @click=${() => state.count++}>
      Increment
    </button>
    <button class=${decrementBtn} @click=${() => state.count--}>
      Decrement
    </button>
  `;
};

const App: FC<{}, HTMLElement> = () => {
  return () => html`<${Counter} />`;
};

defineCustomElement('my-app', {
  render: App,
});

render(document.body, html`<my-app></my-app>`);
```

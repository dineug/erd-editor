import { afterEach, describe, expect, it } from 'vite-plus/test';

import { render } from '@/render';
import { NoopComponent } from '@/render/part/node/component/helper';
import type { Context } from '@/render/part/node/component/observableComponent';
import { html } from '@/template/html';

const containers: HTMLElement[] = [];

function createContainer() {
  const container = document.createElement('div');
  document.body.append(container);
  containers.push(container);
  return container;
}

afterEach(() => {
  let container = containers.pop();
  while (container) {
    render(container, null);
    container.remove();
    container = containers.pop();
  }
});

describe('NoopComponent', () => {
  it('returns a template function that renders nothing', () => {
    const ctx = {
      host: document.body,
      parentElement: null,
      dispatchEvent: () => true,
    } as Context;

    const template = NoopComponent({}, ctx);

    expect(typeof template).toBe('function');
    expect(template()).toBeNull();
  });

  it('returns a new template function on every call', () => {
    const ctx = {} as Context;

    expect(NoopComponent({}, ctx)).not.toBe(NoopComponent({}, ctx));
  });

  it('renders no visible content when used as a component', () => {
    const container = createContainer();

    render(
      container,
      html`<div><${NoopComponent} .value=${'ignored'} /></div>`
    );

    const div = container.querySelector('div') as HTMLElement;
    expect(div).not.toBeNull();
    expect(div.textContent).toBe('');
    expect(div.querySelectorAll('*').length).toBe(0);
  });
});

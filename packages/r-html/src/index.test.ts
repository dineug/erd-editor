import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addCSSHost,
  closestElement,
  compositionActionsFlat,
  createAction,
  createAttributeDirective,
  createContext,
  createNodeDirective,
  createRef,
  createStore,
  css,
  defineCustomElement,
  hmr,
  html,
  innerHTML,
  nextTick,
  NoopComponent,
  observable,
  observer,
  onMounted,
  queryShadowSelector,
  queryShadowSelectorAll,
  ref,
  render,
  repeat,
  setCSSDiagnostics,
  setGlobalStyleOrder,
  svg,
  useContext,
  useProvider,
  watch,
} from '@/index';

const containers: HTMLElement[] = [];

const createContainer = () => {
  const container = document.createElement('div');
  document.body.append(container);
  containers.push(container);
  return container;
};

afterEach(() => {
  containers.splice(0).forEach(container => {
    render(container, null);
    container.remove();
  });
});

describe('public surface', () => {
  it('exports every documented entry point', () => {
    const api = {
      addCSSHost,
      closestElement,
      compositionActionsFlat,
      createAction,
      createAttributeDirective,
      createContext,
      createNodeDirective,
      createRef,
      createStore,
      css,
      defineCustomElement,
      hmr,
      html,
      innerHTML,
      NoopComponent,
      nextTick,
      observable,
      observer,
      onMounted,
      queryShadowSelector,
      queryShadowSelectorAll,
      ref,
      render,
      repeat,
      setCSSDiagnostics,
      setGlobalStyleOrder,
      svg,
      useContext,
      useProvider,
      watch,
    };

    for (const [name, value] of Object.entries(api)) {
      expect(typeof value, name).toBe('function');
    }
  });

  it('hangs the global escape hatch off the css tag itself', () => {
    expect(typeof css.global).toBe('function');
  });
});

describe('html + render', () => {
  it('renders text and attribute bindings', async () => {
    const container = createContainer();

    render(container, html`<div id=${'box'}>${'hello'}</div>`);
    await nextTick(() => {});

    const div = container.querySelector('div') as HTMLDivElement;
    expect(div).not.toBeNull();
    expect(div.getAttribute('id')).toBe('box');
    expect(div.textContent).toBe('hello');
  });

  it('applies a class binding given as an object or an array', async () => {
    const container = createContainer();

    render(container, html`<div class=${{ on: true, off: false }}></div>`);
    await nextTick(() => {});
    const div = container.querySelector('div') as HTMLDivElement;
    expect([...div.classList]).toEqual(['on']);

    render(container, html`<div class=${['a', 'b']}></div>`);
    await nextTick(() => {});
    expect([
      ...(container.querySelector('div') as HTMLDivElement).classList,
    ]).toEqual(['a', 'b']);
  });

  it('ignores a string class binding because only objects and arrays commit', async () => {
    const container = createContainer();

    render(container, html`<div class=${'box'}></div>`);
    await nextTick(() => {});

    expect(
      (container.querySelector('div') as HTMLDivElement).classList.length
    ).toBe(0);
  });

  it('renders nothing for a function child because FunctionPart is a stub', async () => {
    const container = createContainer();

    render(container, html`<div>${() => 'never rendered'}</div>`);
    await nextTick(() => {});

    expect(container.querySelector('div')?.textContent).toBe('');
  });

  it('updates the DOM when re-rendered with new values', async () => {
    const container = createContainer();
    const view = (value: string) => html`<span>${value}</span>`;

    render(container, view('first'));
    await nextTick(() => {});
    expect(container.textContent).toBe('first');

    render(container, view('second'));
    await nextTick(() => {});
    expect(container.textContent).toBe('second');
  });

  it('binds properties, booleans and events', async () => {
    const container = createContainer();
    const onClick = vi.fn();

    render(
      container,
      html`<input .value=${'typed'} ?disabled=${true} @click=${onClick} />`
    );
    await nextTick(() => {});

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('typed');
    expect(input.hasAttribute('disabled')).toBe(true);

    input.dispatchEvent(new Event('click'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders svg templates into the svg namespace', async () => {
    const container = createContainer();

    render(container, html`<svg>${svg`<circle r=${'4'}></circle>`}</svg>`);
    await nextTick(() => {});

    const circle = container.querySelector('circle') as SVGCircleElement;
    expect(circle).not.toBeNull();
    expect(circle.getAttribute('r')).toBe('4');
  });

  it('clears the container when rendering null', async () => {
    const container = createContainer();

    render(container, html`<p>content</p>`);
    await nextTick(() => {});
    expect(container.querySelector('p')).not.toBeNull();

    render(container, null);
    await nextTick(() => {});
    expect(container.querySelector('p')).toBeNull();
  });
});

describe('observable + observer + watch', () => {
  it('re-runs an observer when a tracked property changes', async () => {
    const state = observable({ count: 0 });
    const seen: number[] = [];

    observer(() => {
      seen.push(state.count);
    });
    expect(seen).toEqual([0]);

    state.count = 1;
    await nextTick(() => {});

    expect(seen).toEqual([0, 1]);
  });

  it('stops re-running after the observer is unsubscribed', async () => {
    const state = observable({ count: 0 });
    const spy = vi.fn(() => {
      state.count;
    });

    const unsubscribe = observer(spy);
    unsubscribe();
    state.count = 1;
    await nextTick(() => {});

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits changed property names through watch', async () => {
    const state = observable({ count: 0, name: 'a' });
    const changed: Array<string | number | symbol> = [];
    watch(state).subscribe(propName => changed.push(propName));

    state.count = 1;
    state.name = 'b';
    await nextTick(() => {});

    expect(changed).toEqual(['count', 'name']);
  });

  it('rerenders through an observer that calls render again', async () => {
    const container = createContainer();
    const state = observable({ message: 'one' });

    observer(() => {
      render(container, html`<div>${state.message}</div>`);
    });
    expect(container.textContent).toBe('one');

    state.message = 'two';
    await nextTick(() => {});

    expect(container.textContent).toBe('two');
  });
});

describe('store exports', () => {
  it('creates actions and a working store through the barrel', () => {
    const add = createAction<number>('add');
    const store = createStore<{ total: number }, { add: number }, {}>({
      context: {},
      state: { total: 0 },
      reducers: {
        add: (state, { payload }) => {
          state.total += payload;
        },
      },
    });

    store.dispatchSync(add(2), add(3));

    expect(store.state.total).toBe(5);
    store.destroy();
  });

  it('flattens composition actions through the barrel', () => {
    const add = createAction<number>('add');

    expect(compositionActionsFlat(null, null, [[add(1)], add(2)])).toEqual([
      { type: 'add', payload: 1 },
      { type: 'add', payload: 2 },
    ]);
  });
});

describe('directives', () => {
  it('creates a ref object and binds it to the rendered node', async () => {
    const container = createContainer();
    const refObject = createRef<HTMLDivElement>();

    expect(refObject).toEqual({ value: undefined });

    render(container, html`<div ${ref(refObject)}>ref</div>`);
    await nextTick(() => {});

    expect(refObject.value).toBe(container.querySelector('div'));
  });

  it('renders raw html with the innerHTML directive', async () => {
    const container = createContainer();

    render(container, html`<div>${innerHTML('<b>bold</b>')}</div>`);
    await nextTick(() => {});

    expect(container.querySelector('b')?.textContent).toBe('bold');
  });

  it('renders a keyed list with the repeat directive', async () => {
    const container = createContainer();
    const list = observable([{ id: 1 }, { id: 2 }]);

    render(
      container,
      html`<ul>
        ${repeat(
          list,
          item => item.id,
          item => html`<li>${`${item.id}`}</li>`
        )}
      </ul>`
    );
    await nextTick(() => {});

    expect(
      Array.from(container.querySelectorAll('li')).map(li => li.textContent)
    ).toEqual(['1', '2']);
  });
});

describe('component helpers', () => {
  it('NoopComponent renders nothing', () => {
    expect(NoopComponent({}, {} as any)()).toBeNull();
  });

  it('closestElement walks up through shadow boundaries', () => {
    const container = createContainer();
    container.className = 'root';
    const host = document.createElement('div');
    container.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('span');
    shadow.append(inner);

    expect(closestElement('.root', inner)).toBe(container);
    expect(closestElement('.missing', inner)).toBeNull();
    expect(closestElement('.root', null)).toBeNull();
  });

  it('queryShadowSelector crosses shadow roots', () => {
    const container = createContainer();
    const host = document.createElement('div');
    host.id = 'host';
    container.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('p');
    inner.className = 'inner';
    shadow.append(inner);

    expect(queryShadowSelector(['#host', '.inner'], container)).toBe(inner);
    expect(queryShadowSelector([], container)).toBeNull();
    expect(queryShadowSelectorAll(['.inner'], host)).toEqual([inner]);
    expect(queryShadowSelectorAll([], host)).toEqual([]);
  });
});

describe('css', () => {
  it('builds a css template literal with a string identifier', () => {
    const color = 'red';
    const styles = css`
      div {
        color: ${color};
      }
    `;

    expect(styles.values).toEqual([color]);
    expect(typeof styles.toString()).toBe('string');
  });
});

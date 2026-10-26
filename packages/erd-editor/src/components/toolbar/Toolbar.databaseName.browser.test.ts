// A readonly editor's database name laid out in a real Chromium, where the
// field it replaces takes the engine's control font, not the editor's own.

import {
  addCSSHost,
  FC,
  html,
  observable,
  render,
  useProvider,
} from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__';
import { appContext } from '@/components/appContext';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import Toolbar from '@/components/toolbar/Toolbar';
import * as styles from '@/components/toolbar/Toolbar.styles';
import { changeDatabaseNameAction } from '@/engine/modules/settings/atom.actions';

const teardowns: Array<() => void> = [];

afterEach(() => {
  teardowns.splice(0).forEach(teardown => teardown());
});

/** Mounts the bar where its stylesheets are live, in a shadow root as the element has one, writable until the flag turns. */
async function setup(databaseName: string) {
  const app = createTestAppContext();
  app.store.dispatchSync(changeDatabaseNameAction({ value: databaseName }));
  const flags = observable({ readonly: false });
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  const globals = document.createElement('div');
  const root = document.createElement('div');
  root.setAttribute('style', 'width: 1000px;');
  shadow.append(globals, root);

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const provider = useProvider(root as any, appContext, app);
  const Host: FC = () => () =>
    html`<${Toolbar} enableThemeBuilder=${false} readonly=${flags.readonly} />`;
  render(globals, html`<${GlobalStyles} />`);
  render(root, html`<${Host} />`);

  teardowns.push(() => {
    render(root, null);
    render(globals, null);
    provider.destroy();
    host.remove();
  });
  await flush();

  return { root, flags };
}

const fontOf = (el: Element) => {
  const { fontFamily, fontSize, fontStyle, fontWeight } = getComputedStyle(el);
  return { fontFamily, fontSize, fontStyle, fontWeight };
};

const field = (root: HTMLElement) =>
  root.querySelector('.toolbar > input') as HTMLInputElement;

const nameText = (root: HTMLElement) =>
  root.querySelector(`.${String(styles.databaseName)}`) as HTMLDivElement;

/** Where the ERD tab's button starts, which only the width and spacing before it move. */
const firstTabLeft = (root: HTMLElement) =>
  root
    .querySelector('.toolbar > [title="Entity Relationship Diagram"]')!
    .getBoundingClientRect().left;

describe("a readonly editor's database name in the browser", () => {
  it("is drawn in the field's font, not in the larger one the editor sets", async () => {
    const { root, flags } = await setup('shop');
    const fieldFont = fontOf(field(root));
    const editorFont = fontOf(root.querySelector('.toolbar')!);

    flags.readonly = true;
    await flush();

    expect(nameText(root).textContent?.trim()).toBe('shop');
    expect(fontOf(nameText(root))).toEqual(fieldFont);
    expect(fieldFont.fontSize).not.toBe(editorFont.fontSize);
  });

  it('takes the room the field took, so the tabs after it stay where they stood', async () => {
    const { root, flags } = await setup(
      'ecommerce_production_analytics_warehouse'
    );
    const fieldBox = field(root).getBoundingClientRect();
    const tabLeft = firstTabLeft(root);

    flags.readonly = true;
    await flush();

    const text = nameText(root);
    expect(text.getBoundingClientRect().left).toBe(fieldBox.left);
    expect(text.getBoundingClientRect().width).toBe(fieldBox.width);
    expect(firstTabLeft(root)).toBe(tabLeft);
    expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
    expect(getComputedStyle(text).textOverflow).toBe('ellipsis');
  });
});

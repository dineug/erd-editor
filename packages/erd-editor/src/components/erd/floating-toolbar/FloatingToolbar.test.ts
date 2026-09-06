import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import FloatingToolbar from '@/components/erd/floating-toolbar/FloatingToolbar';
import * as styles from '@/components/erd/floating-toolbar/FloatingToolbar.styles';
import { RelationshipType } from '@/constants/schema';
import {
  changeHandToolAction,
  drawStartRelationshipAction,
} from '@/engine/modules/editor/atom.actions';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function setup(app: AppContext = createTestAppContext()) {
  mounted = await mountAndFlush(html`<${FloatingToolbar} />`, app);
  const root = mounted.container.querySelector(
    '.floating-toolbar'
  ) as HTMLDivElement;

  return { app, root };
}

const menus = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(`.${String(styles.menu)}`));

const byTitle = (root: HTMLElement, name: string) =>
  root.querySelector<HTMLElement>(`[title^="${name}"]`)!;

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

const isActive = (el: Element) => el.className.includes('active');

describe('FloatingToolbar', () => {
  it('draws the two tools, the four notations and zen mode, in that order', async () => {
    const { root } = await setup();

    expect(menus(root).map(menu => menu.getAttribute('title'))).toEqual([
      'Hand (Space)',
      'Select (Space)',
      expect.stringMatching(/^Zero One \(/),
      expect.stringMatching(/^Zero N \(/),
      expect.stringMatching(/^One Only \(/),
      expect.stringMatching(/^One N \(/),
      expect.stringMatching(/^Zen Mode \(/),
    ]);
  });

  it('names one chord per button, which is the first one bound to it', async () => {
    const { app, root } = await setup();
    app.keyBindingMap.zenMode = [
      { shortcut: 'Alt+KeyZ' },
      { shortcut: 'Alt+KeyQ' },
    ];
    await flush();

    const title = byTitle(root, 'Zen Mode').getAttribute('title') ?? '';
    expect(title).toContain('Z');
    expect(title).not.toContain('Q');
  });

  it('marks the tool the canvas is in, which is select until the hand is taken up', async () => {
    const { app, root } = await setup();

    expect(isActive(byTitle(root, 'Hand'))).toBe(false);
    expect(isActive(byTitle(root, 'Select'))).toBe(true);

    click(byTitle(root, 'Hand'));
    await flush();

    expect(app.store.state.editor.handTool).toBe(true);
    expect(isActive(byTitle(root, 'Hand'))).toBe(true);
    expect(isActive(byTitle(root, 'Select'))).toBe(false);

    click(byTitle(root, 'Select'));
    await flush();

    expect(app.store.state.editor.handTool).toBe(false);
  });

  it('arms a notation, marks it, and puts the pointer back in hand for it', async () => {
    const { app, root } = await setup();
    app.store.dispatchSync(changeHandToolAction({ value: true }));
    await flush();

    click(byTitle(root, 'Zero N'));
    await flush();

    expect(app.store.state.editor.drawRelationship?.relationshipType).toBe(
      RelationshipType.ZeroN
    );
    expect(app.store.state.editor.handTool).toBe(false);
    expect(isActive(byTitle(root, 'Zero N'))).toBe(true);
    expect(isActive(byTitle(root, 'One N'))).toBe(false);
  });

  it('disarms the notation a second press names, the way the chord does', async () => {
    const { app, root } = await setup();
    app.store.dispatchSync(
      drawStartRelationshipAction({
        relationshipType: RelationshipType.OneOnly,
      })
    );
    await flush();

    click(byTitle(root, 'One Only'));
    await flush();

    expect(app.store.state.editor.drawRelationship).toBeNull();
  });

  it('toggles zen mode, and says which of the two icons it is showing', async () => {
    const { app, root } = await setup();

    expect(root.querySelector('.zen-mode svg')).toBeTruthy();

    click(byTitle(root, 'Zen Mode'));
    await flush();

    expect(app.store.state.editor.zenMode).toBe(true);
    expect(isActive(byTitle(root, 'Zen Mode'))).toBe(true);

    click(byTitle(root, 'Zen Mode'));
    await flush();

    expect(app.store.state.editor.zenMode).toBe(false);
  });
});

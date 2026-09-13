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
import { ZOOM_STEP } from '@/constants/zoom';
import {
  changeHandToolAction,
  drawStartRelationshipAction,
} from '@/engine/modules/editor/atom.actions';
import { ViewKind } from '@/engine/modules/editor/state';
import {
  viewChangeZoomLevelAction,
  viewOpenAction,
} from '@/engine/modules/editor/view.actions';
import { scrollToAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';

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

const zoom = (root: HTMLElement) =>
  root.querySelector<HTMLElement>(`.${String(styles.readout)}`)?.textContent;

const compass = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.content-compass');

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

const isActive = (el: Element) => el.className.includes('active');

describe('FloatingToolbar', () => {
  it('draws the two tools, the zoom, the four notations and zen mode, in that order', async () => {
    const { root } = await setup();

    expect(menus(root).map(menu => menu.getAttribute('title'))).toEqual([
      'Hand (Space)',
      'Select (Space)',
      expect.stringMatching(/^Zoom out/),
      expect.stringMatching(/^Zoom in/),
      expect.stringMatching(/^Zero One \(/),
      expect.stringMatching(/^Zero N \(/),
      expect.stringMatching(/^One Only \(/),
      expect.stringMatching(/^One N \(/),
      expect.stringMatching(/^Zen Mode \(/),
    ]);
    expect(zoom(root)).toBe('100%');
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

  /*
   * The zoom left the top bar for this one, which stands over the canvas it
   * drives. It reads the document's zoom and steps it, and the range it is
   * held in is the document's own.
   */
  it('steps the zoom one notch either way from the two buttons', async () => {
    const { app, root } = await setup();

    click(byTitle(root, 'Zoom in'));
    await flush();

    expect(app.store.state.settings.zoomLevel).toBeCloseTo(1 + ZOOM_STEP, 5);
    expect(zoom(root)).toBe('104%');

    click(byTitle(root, 'Zoom out'));
    await flush();

    expect(app.store.state.settings.zoomLevel).toBeCloseTo(1, 5);
    expect(zoom(root)).toBe('100%');
  });

  it('stops the run at either end of the range the document holds', async () => {
    const { app, root } = await setup();

    for (let press = 0; press < 30; press++) click(byTitle(root, 'Zoom in'));
    await flush();

    expect(app.store.state.settings.zoomLevel).toBe(1.5);
    expect(zoom(root)).toBe('150%');

    for (let press = 0; press < 60; press++) click(byTitle(root, 'Zoom out'));
    await flush();

    expect(app.store.state.settings.zoomLevel).toBe(0.1);
    expect(zoom(root)).toBe('10%');
  });

  /**
   * It drives the document and nothing else. A Flow view left standing at
   * another zoom is neither printed here nor moved from here, which is where
   * the view redirect ends: at the document, on the tab the document is drawn on.
   */
  it('drives the document zoom alone, leaving an open view where it stands', async () => {
    const { app, root } = await setup();
    app.store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    app.store.dispatchSync(
      viewChangeZoomLevelAction({ value: 0.5, kind: ViewKind.flow })
    );
    await flush();

    expect(zoom(root)).toBe('100%');

    const { originX, originY } = app.store.state.editor.views.flow!;
    click(byTitle(root, 'Zoom out'));
    await flush();

    expect(app.store.state.settings.zoomLevel).toBeCloseTo(1 - ZOOM_STEP, 5);
    expect(zoom(root)).toBe('96%');
    expect(app.store.state.editor.views.flow!.zoomLevel).toBe(0.5);
    expect(app.store.state.editor.views.flow!.originX).toBe(originX);
    expect(app.store.state.editor.views.flow!.originY).toBe(originY);
  });

  /*
   * The compass the ERD kept as a pill of its own is the last tool in the bar
   * now. It comes and goes with the screen: nothing while the document is in
   * front of the reader, and a heading and a gap once it is not.
   */
  it('carries the compass once the screen holds no content, and not before', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      addTableAction({ id: 'users', ui: { x: 0, y: 0, zIndex: 2 } })
    );
    const { root } = await setup(app);

    expect(compass(root)).toBeNull();

    app.store.dispatchSync(
      scrollToAction({ originX: -5_000, originY: -4_000 })
    );
    await flush();

    expect(compass(root)).toBeTruthy();
    expect(compass(root)?.querySelector('.icon')).toBeTruthy();
    expect(compass(root)?.querySelector('span')?.textContent).toMatch(/\S/);
  });

  it('puts the nearest content back on the screen when that compass is pressed', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      addTableAction({ id: 'users', ui: { x: 0, y: 0, zIndex: 2 } })
    );
    const { root } = await setup(app);
    app.store.dispatchSync(
      scrollToAction({ originX: -5_000, originY: -4_000 })
    );
    await flush();

    click(compass(root)!);
    await flush();

    expect(compass(root)).toBeNull();
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

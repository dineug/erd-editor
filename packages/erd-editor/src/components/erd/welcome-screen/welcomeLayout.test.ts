import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import {
  ARROW_DOWN_BOX,
  ARROW_UP_BOX,
  hintPlacement,
  isEmptyDocument,
  measureAnchors,
  WELCOME_FULL_MIN_HEIGHT,
  WELCOME_HINTS_MIN_HEIGHT,
  WELCOME_HINTS_MIN_WIDTH,
  WELCOME_KBD_MIN_WIDTH,
  WELCOME_MENU_MIN_HEIGHT,
  WELCOME_MIN_WIDTH,
  welcomeTiers,
} from '@/components/erd/welcome-screen/welcomeLayout';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';

const ROOMY = { width: 1440, height: 900 };

describe('welcomeTiers', () => {
  it('shows everything on a roomy canvas', () => {
    expect(welcomeTiers(ROOMY)).toEqual({
      center: 'full',
      hints: true,
      kbd: true,
    });
  });

  it('hides the whole screen one pixel under the narrowest width', () => {
    const height = ROOMY.height;

    expect(welcomeTiers({ width: WELCOME_MIN_WIDTH, height }).center).toBe(
      'full'
    );
    expect(welcomeTiers({ width: WELCOME_MIN_WIDTH - 1, height })).toEqual({
      center: 'none',
      hints: false,
      kbd: false,
    });
  });

  it('drops the logo and heading one pixel under the full height, and the menu under its own', () => {
    const width = ROOMY.width;

    expect(
      welcomeTiers({ width, height: WELCOME_FULL_MIN_HEIGHT }).center
    ).toBe('full');
    expect(
      welcomeTiers({ width, height: WELCOME_FULL_MIN_HEIGHT - 1 }).center
    ).toBe('menu');
    expect(
      welcomeTiers({ width, height: WELCOME_MENU_MIN_HEIGHT }).center
    ).toBe('menu');
    expect(
      welcomeTiers({ width, height: WELCOME_MENU_MIN_HEIGHT - 1 }).center
    ).toBe('none');
  });

  it('shows the hints only from their width and height on', () => {
    const at = {
      width: WELCOME_HINTS_MIN_WIDTH,
      height: WELCOME_HINTS_MIN_HEIGHT,
    };

    expect(welcomeTiers(at).hints).toBe(true);
    expect(welcomeTiers({ ...at, width: at.width - 1 }).hints).toBe(false);
    expect(welcomeTiers({ ...at, height: at.height - 1 }).hints).toBe(false);
    expect(welcomeTiers({ width: 700, height: 500 }).hints).toBe(false);
  });

  it('shows the chords only from their width on, and never without a menu', () => {
    const height = ROOMY.height;

    expect(welcomeTiers({ width: WELCOME_KBD_MIN_WIDTH, height }).kbd).toBe(
      true
    );
    expect(welcomeTiers({ width: WELCOME_KBD_MIN_WIDTH - 1, height }).kbd).toBe(
      false
    );
    expect(
      welcomeTiers({ width: ROOMY.width, height: WELCOME_MENU_MIN_HEIGHT - 1 })
        .kbd
    ).toBe(false);
  });
});

describe('isEmptyDocument', () => {
  it('holds for a new document and fails once a table or a memo exists', () => {
    const withTable = createTestAppContext();
    const withMemo = createTestAppContext();

    expect(isEmptyDocument(withTable.store.state)).toBe(true);

    withTable.store.dispatchSync(
      addTableAction({ id: 't', ui: { x: 0, y: 0, zIndex: 2 } })
    );
    withMemo.store.dispatchSync(
      addMemoAction({ id: 'm', ui: { x: 0, y: 0, zIndex: 2 } })
    );

    expect(isEmptyDocument(withTable.store.state)).toBe(false);
    expect(isEmptyDocument(withMemo.store.state)).toBe(false);
  });
});

describe('hintPlacement', () => {
  const reach = ARROW_UP_BOX.width - ARROW_UP_BOX.tipX;

  it('puts a before label left of its arrow in a left-to-right language, the tip on the anchor', () => {
    expect(hintPlacement(300, 1000, 'before', 'ltr')).toEqual({
      labelFirst: true,
      right: 1000 - 300 - reach,
    });
  });

  it('puts an after label right of its mirrored arrow in a left-to-right language', () => {
    expect(hintPlacement(300, 1000, 'after', 'ltr')).toEqual({
      labelFirst: false,
      left: 300 - reach,
    });
  });

  it('flips both sides in a right-to-left language', () => {
    expect(hintPlacement(700, 1000, 'before', 'rtl')).toEqual({
      labelFirst: false,
      left: 700 - reach,
    });
    expect(hintPlacement(700, 1000, 'after', 'rtl')).toEqual({
      labelFirst: true,
      right: 1000 - 700 - reach,
    });
  });

  it('draws both arrows with their tips inside their own boxes', () => {
    for (const box of [ARROW_UP_BOX, ARROW_DOWN_BOX]) {
      expect(box.tipX).toBeGreaterThan(0);
      expect(box.tipX).toBeLessThan(box.width);
      expect(box.tipY).toBeGreaterThan(0);
      expect(box.tipY).toBeLessThan(box.height);
    }
  });
});

describe('measureAnchors', () => {
  const rects = new Map<Element, Partial<DOMRect>>();

  const rect = (left: number, width: number) =>
    ({
      left,
      width,
      top: 0,
      height: 30,
      right: left + width,
      bottom: 30,
    }) as DOMRect;

  /** An editor root holding a toolbar with the buttons named, and the welcome screen under it. */
  function setup(buttons: Record<string, [left: number, width: number]>) {
    const root = document.createElement('div');
    root.className = 'root';
    const toolbar = document.createElement('div');
    const container = document.createElement('div');

    for (const [name, [left, width]] of Object.entries(buttons)) {
      const button = document.createElement('div');
      button.className = name;
      toolbar.append(button);
      rects.set(button, rect(left, width));
    }

    rects.set(container, rect(100, 1000));
    root.append(toolbar, container);
    document.body.append(root);

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        return (rects.get(this) ?? rect(0, 0)) as DOMRect;
      }
    );

    return container;
  }

  afterEach(() => {
    rects.clear();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('reads each button from the left edge of the welcome screen', () => {
    const container = setup({
      'toolbar-search': [420, 26],
      'toolbar-theme': [472, 26],
      'toolbar-locale': [498, 26],
    });

    expect(measureAnchors(container)).toEqual({
      search: 333,
      // Halfway between the two buttons, which share the one hint.
      preferences: 398,
    });
  });

  it('points the preferences hint at whichever of the two buttons is there', () => {
    expect(measureAnchors(setup({ 'toolbar-theme': [472, 26] }))).toEqual({
      search: null,
      preferences: 385,
    });

    rects.clear();
    vi.restoreAllMocks();
    document.body.replaceChildren();

    expect(measureAnchors(setup({ 'toolbar-locale': [498, 26] }))).toEqual({
      search: null,
      preferences: 411,
    });
  });

  it('measures nothing for a button the toolbar left out, laid out at no size or clipped past an edge', () => {
    const container = setup({
      'toolbar-search': [420, 0],
      'toolbar-theme': [1200, 26],
      'toolbar-locale': [40, 26],
    });

    expect(measureAnchors(container)).toEqual({
      search: null,
      preferences: null,
    });
  });

  it('reads the buttons of the editor root it sits in, or of itself where it sits in none', () => {
    const lone = document.createElement('div');
    const search = document.createElement('div');
    search.className = 'toolbar-search';
    lone.append(search);
    document.body.append(lone);
    rects.set(lone, rect(0, 500));
    rects.set(search, rect(40, 20));

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        return (rects.get(this) ?? rect(0, 0)) as DOMRect;
      }
    );

    expect(measureAnchors(lone).search).toBe(50);
  });
});

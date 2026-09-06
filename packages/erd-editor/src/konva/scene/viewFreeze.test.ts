import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { getMinimapLayout } from '@/components/erd/minimap/minimapGeometry';
import { createEditor } from '@/engine/modules/editor/state';
import { getScrollRanges } from '@/engine/modules/settings/atom.actions';
import { RootState } from '@/engine/state';
import { getContentRect } from '@/konva/scene/contentBounds';
import {
  freezeView,
  getFrozenOrigin,
  getViewContentRect,
  isViewFrozen,
  thawView,
} from '@/konva/scene/viewFreeze';
import { createTable } from '@/utils/collection/table.entity';

/** A measured store holding one table, the way an editor on a page does. */
function stateWith(x: number, y: number): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };

  state.editor.viewport = { width: 1200, height: 675 };
  state.collections.tableEntities.t = createTable({ id: 't', ui: { x, y } });
  state.doc.tableIds.push('t');

  return state;
}

describe('viewFreeze', () => {
  it('starts with nothing held', () => {
    const state = stateWith(0, 0);

    expect(isViewFrozen(state)).toBe(false);
    expect(getFrozenOrigin(state)).toBeNull();
    expect(getViewContentRect(state)).toEqual(getContentRect(state));
  });

  it('holds the content rect and the origin as they stood, and lets them go', () => {
    const state = stateWith(300, 200);
    state.settings.originX = -40;
    state.settings.originY = 25;
    const content = getContentRect(state);

    freezeView(state);
    state.collections.tableEntities.t.ui.x = 9_000;
    state.settings.originX = -5_000;

    expect(isViewFrozen(state)).toBe(true);
    expect(getViewContentRect(state)).toEqual(content);
    expect(getFrozenOrigin(state)).toEqual({ x: -40, y: 25 });

    thawView(state);

    expect(isViewFrozen(state)).toBe(false);
    expect(getFrozenOrigin(state)).toBeNull();
    expect(getViewContentRect(state)).toEqual(getContentRect(state));
    expect(getViewContentRect(state)).not.toEqual(content);
  });

  /**
   * A diff viewer mounts two stores side by side and a page may host two
   * editors: a drag in one holds that one's view, and the other's scroll
   * ranges and minimap keep following the other's own content and origin.
   */
  it('holds one store and leaves another live', () => {
    const held = stateWith(0, 0);
    const live = stateWith(100, 100);
    const ranges = getScrollRanges(live);
    const layout = getMinimapLayout(live);

    freezeView(held);

    expect(isViewFrozen(held)).toBe(true);
    expect(isViewFrozen(live)).toBe(false);
    expect(getFrozenOrigin(live)).toBeNull();

    live.collections.tableEntities.t.ui.x = 9_000;
    live.settings.originX = -5_000;

    expect(getViewContentRect(live)).toEqual(getContentRect(live));
    expect(getScrollRanges(live)).not.toEqual(ranges);
    expect(getMinimapLayout(live)).not.toEqual(layout);
    // The hull holds the live origin and no anchor of the other store's.
    expect(getScrollRanges(live).left.max).toBe(-5_000);

    thawView(live);
    expect(isViewFrozen(held)).toBe(true);

    thawView(held);
    expect(isViewFrozen(held)).toBe(false);
  });

  it('holds two stores at once and releases each on its own', () => {
    const a = stateWith(0, 0);
    const b = stateWith(500, 500);

    freezeView(a);
    freezeView(b);
    expect(isViewFrozen(a)).toBe(true);
    expect(isViewFrozen(b)).toBe(true);

    thawView(a);
    expect(isViewFrozen(a)).toBe(false);
    expect(isViewFrozen(b)).toBe(true);

    thawView(b);
    expect(isViewFrozen(b)).toBe(false);
  });
});

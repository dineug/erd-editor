import { describe, expect, it } from 'vite-plus/test';

import type { SceneMouseEvent } from '@/components/erd/canvas/sceneTokens';
import { createDoubleClickGuard } from '@/components/erd/canvas/table/doubleClick';
import { FocusType } from '@/engine/modules/editor/state';

const click = (detail?: number) =>
  ({ evt: detail === undefined ? {} : { detail } }) as SceneMouseEvent;

const NAME = FocusType.tableName;
const COMMENT = FocusType.tableComment;

describe('what counts as a double click on a scene cell', () => {
  it('takes the second click of a pair that began on the same cell', () => {
    const guard = createDoubleClickGuard();

    guard.track(NAME, click(1));
    expect(guard.isDouble(NAME, click(2))).toBe(true);
  });

  it('refuses a pair konva closed on a different cell', () => {
    const guard = createDoubleClickGuard();

    guard.track(NAME, click(1));
    expect(guard.isDouble(COMMENT, click(2))).toBe(false);
  });

  it('refuses a cell no click has opened a pair on', () => {
    const guard = createDoubleClickGuard();

    expect(guard.isDouble(NAME, click(2))).toBe(false);
  });

  it('refuses a single click, and an event with no count at all', () => {
    const guard = createDoubleClickGuard();

    guard.track(NAME, click(1));
    expect(guard.isDouble(NAME, click(1))).toBe(false);
    expect(guard.isDouble(NAME, click())).toBe(false);
  });

  it('never lets the second click of a pair open the next one', () => {
    const guard = createDoubleClickGuard();

    guard.track(NAME, click(1));
    guard.track(COMMENT, click(2));

    expect(guard.isDouble(COMMENT, click(2))).toBe(false);
    expect(guard.isDouble(NAME, click(2))).toBe(true);
  });
});

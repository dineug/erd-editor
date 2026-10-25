import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { scopeClicksToStage } from '@/components/erd/canvas/stagePressScope';

const FIELDS = [
  'mouseClickStartShape',
  'mouseClickEndShape',
  'pointerClickStartShape',
  'pointerClickEndShape',
  'touchClickStartShape',
  'touchClickEndShape',
];

const teardowns: Array<() => void> = [];

afterEach(() => {
  teardowns.splice(0).forEach(teardown => teardown());
});

/** A stage as the guard reads it: the content box konva listens on, and the shapes it last kept. */
function stageIn(content: HTMLElement): Stage {
  const stage = { content } as unknown as Stage;
  for (const field of FIELDS) Reflect.set(stage, field, field);
  return stage;
}

const kept = (stage: Stage) =>
  FIELDS.filter(field => Reflect.get(stage, field) !== undefined);

describe('scopeClicksToStage', () => {
  it('forgets the shapes of a stage for a press of each kind outside it', () => {
    const content = document.createElement('div');
    const elsewhere = document.createElement('div');
    document.body.append(content, elsewhere);
    teardowns.push(
      () => content.remove(),
      () => elsewhere.remove()
    );

    for (const type of ['mousedown', 'pointerdown', 'touchstart']) {
      const stage = stageIn(content);
      teardowns.push(scopeClicksToStage(stage));

      elsewhere.dispatchEvent(new Event(type, { bubbles: true }));

      const kind = type.slice(0, type.search(/down|start/));
      expect(kept(stage)).toEqual(
        FIELDS.filter(field => !field.startsWith(kind))
      );
    }
  });

  it('keeps them for a press on the stage itself, which konva files', () => {
    const content = document.createElement('div');
    document.body.append(content);
    teardowns.push(() => content.remove());
    const stage = stageIn(content);
    teardowns.push(scopeClicksToStage(stage));

    content.dispatchEvent(new Event('mousedown', { bubbles: true }));

    expect(kept(stage)).toEqual(FIELDS);
  });

  it('listens on the page for a stage whose document has no window, and stops once unscoped', () => {
    const content = {
      ownerDocument: { defaultView: null },
    } as unknown as HTMLElement;
    const stage = stageIn(content);
    const unscope = scopeClicksToStage(stage);

    window.dispatchEvent(new Event('mousedown'));
    expect(kept(stage)).not.toContain('mouseClickStartShape');

    unscope();
    Reflect.set(stage, 'pointerClickStartShape', 'pointerClickStartShape');
    window.dispatchEvent(new Event('pointerdown'));
    expect(kept(stage)).toContain('pointerClickStartShape');
  });
});

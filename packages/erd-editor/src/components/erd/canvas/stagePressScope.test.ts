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

const PRESSES = [
  ['mousedown', 'mouseup', 'mouse'],
  ['pointerdown', 'pointerup', 'pointer'],
  ['touchstart', 'touchend', 'touch'],
] as const;

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

/** A content box and a node beside it, both on the page. */
function onPage() {
  const content = document.createElement('div');
  const elsewhere = document.createElement('div');
  document.body.append(content, elsewhere);
  teardowns.push(
    () => content.remove(),
    () => elsewhere.remove()
  );
  return { content, elsewhere };
}

/** What a stage keeps as konva hears an event of a type, on its content after every capture listener. */
function keptAsKonvaHears(stage: Stage, type: string) {
  let heard: string[] = [];
  const listener = () => {
    heard = kept(stage);
  };
  stage.content.addEventListener(type, listener);
  teardowns.push(() => stage.content.removeEventListener(type, listener));
  return () => heard;
}

const fire = (target: EventTarget, type: string) =>
  target.dispatchEvent(new Event(type, { bubbles: true }));

describe('scopeClicksToStage', () => {
  it('forgets the shapes of a kind before konva hears a lift on the stage of a press outside it', () => {
    const { content, elsewhere } = onPage();

    for (const [press, lift, kind] of PRESSES) {
      const stage = stageIn(content);
      teardowns.push(scopeClicksToStage(stage));
      const heard = keptAsKonvaHears(stage, lift);

      fire(elsewhere, press);
      fire(content, lift);

      expect(heard()).toEqual(FIELDS.filter(field => !field.startsWith(kind)));
    }
  });

  it('forgets them before konva hears the next press on the stage after one outside it', () => {
    const { content, elsewhere } = onPage();

    for (const [press, lift, kind] of PRESSES) {
      const stage = stageIn(content);
      teardowns.push(scopeClicksToStage(stage));
      const heard = keptAsKonvaHears(stage, press);

      fire(elsewhere, press);
      fire(elsewhere, lift);
      fire(content, press);

      expect(heard()).toEqual(FIELDS.filter(field => !field.startsWith(kind)));
    }
  });

  it('keeps them through two presses and lifts on the stage itself, a double click', () => {
    const { content } = onPage();
    const stage = stageIn(content);
    teardowns.push(scopeClicksToStage(stage));

    for (const [press, lift] of PRESSES) {
      fire(content, press);
      fire(content, lift);
      fire(content, press);
      fire(content, lift);
    }

    expect(kept(stage)).toEqual(FIELDS);
  });

  it('listens on the page for a stage whose document has no window, and stops once unscoped', () => {
    const content = document.implementation
      .createHTMLDocument()
      .createElement('div');
    const stage = stageIn(content);
    const unscope = scopeClicksToStage(stage);

    fire(window, 'mousedown');
    fire(content, 'mouseup');
    expect(kept(stage)).not.toContain('mouseClickStartShape');

    unscope();
    Reflect.set(stage, 'mouseClickStartShape', 'mouseClickStartShape');
    fire(window, 'mousedown');
    fire(content, 'mouseup');
    expect(kept(stage)).toContain('mouseClickStartShape');
  });
});

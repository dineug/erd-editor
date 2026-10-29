import type { Stage } from 'konva/lib/Stage';

/** Each event a press starts with, the one that lifts it, and the kind konva files both under. */
const PRESSES = [
  ['mousedown', 'mouseup', 'mouse'],
  ['pointerdown', 'pointerup', 'pointer'],
  ['touchstart', 'touchend', 'touch'],
] as const;

/** Adds a passive capture listener and returns what removes it. */
function listen(target: EventTarget, type: string, listener: () => void) {
  target.addEventListener(type, listener, { capture: true, passive: true });
  return () => target.removeEventListener(type, listener, { capture: true });
}

/**
 * Forgets the shapes a stage was last pressed and lifted on after a press starts
 * anywhere else, so a click and a double click need their presses on this one:
 * konva arms both on every stage of its copy, wherever the press landed.
 *
 * @example
 * addUnsubscribe(scopeClicksToStage($stage));
 */
export function scopeClicksToStage(stage: Stage): () => void {
  const { content } = stage;
  const view = content.ownerDocument.defaultView ?? window;
  const removes = PRESSES.flatMap(([press, lift, kind]) => {
    // The page hears a press first and the stage's own listener before konva,
    // so a press the stage never heard landed elsewhere. The page cannot tell
    // itself: its path holds no node inside a closed shadow root.
    let elsewhere = false;
    const forget = () => {
      Reflect.set(stage, `${kind}ClickStartShape`, undefined);
      Reflect.set(stage, `${kind}ClickEndShape`, undefined);
    };

    return [
      listen(view, press, () => {
        if (elsewhere) forget();
        elsewhere = true;
      }),
      listen(content, press, () => {
        elsewhere = false;
      }),
      listen(content, lift, () => {
        if (elsewhere) forget();
      }),
    ];
  });

  return () => removes.forEach(remove => remove());
}

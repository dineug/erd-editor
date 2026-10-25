import type { Stage } from 'konva/lib/Stage';

/** The kind konva files a press under, for each event a press starts with. */
const KIND_OF = {
  mousedown: 'mouse',
  pointerdown: 'pointer',
  touchstart: 'touch',
} as const;

/**
 * Forgets the shapes a stage was last pressed and lifted on as a press starts
 * anywhere else, so a click and a double click need their presses on this one:
 * konva arms both on every stage of its copy, wherever the press landed.
 *
 * @example
 * addUnsubscribe(scopeClicksToStage($stage));
 */
export function scopeClicksToStage(stage: Stage): () => void {
  const view = stage.content.ownerDocument.defaultView ?? window;
  const removes = Object.entries(KIND_OF).map(([type, kind]) => {
    const forget = (event: Event) => {
      if (event.composedPath().includes(stage.content)) return;
      Reflect.set(stage, `${kind}ClickStartShape`, undefined);
      Reflect.set(stage, `${kind}ClickEndShape`, undefined);
    };
    view.addEventListener(type, forget, { capture: true, passive: true });
    return () => view.removeEventListener(type, forget, { capture: true });
  });

  return () => removes.forEach(remove => remove());
}

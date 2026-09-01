import { DOMTemplateLiterals } from '@dineug/r-html';

import { Emitter, openToastAction } from '@/utils/emitter';
import { delay } from '@/utils/promise';

/**
 * How long a task runs before it is worth saying so. Measured on the built
 * bundle, a png export of a 4000, 6000 or 8000 square canvas lands in 176 to
 * 298 ms with no dropped frame; the first one a person waits for is past this.
 */
const SHOW_AFTER = 400;

/**
 * How long the toast stays once it is up, counted from when it opened. The
 * entry animation runs 300 ms, so anything shorter is a message the reader
 * only ever sees fading in; this is that animation and as long again to read.
 */
const MIN_VISIBLE = 600;

const settle = (promise: Promise<unknown>) =>
  promise.then(
    () => {},
    () => {}
  );

/**
 * Says that something is running, but only when it runs long enough to be
 * worth a message. Resolves once nothing is left on screen for it, which lets
 * a caller report the outcome after this toast rather than on top of it.
 *
 * @example
 * await openToastWhileRunning(emitter, running, html`<${Toast} description=${'Working'} />`);
 */
export function openToastWhileRunning(
  emitter: Emitter,
  running: Promise<unknown>,
  message: DOMTemplateLiterals
): Promise<void> {
  const settled = settle(running);

  return Promise.race([
    settled.then(() => false),
    delay(SHOW_AFTER).then(() => true),
  ]).then(slow => {
    if (!slow) return;

    // The toast is given a close promise of its own because the caller's can
    // reject, and the container only ever calls finally on what it is handed.
    const close = Promise.all([settled, delay(MIN_VISIBLE)]).then(() => {});
    emitter.emit(openToastAction({ message, close }));

    return close;
  });
}

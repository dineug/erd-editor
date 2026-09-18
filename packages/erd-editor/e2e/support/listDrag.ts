/**
 * One painted frame of a draggable list: the rows in the order the DOM holds
 * them, which is the order the store gave them, each with its painted top.
 */
export type ListFrame = { order: string[]; tops: number[] };

export type ListDragRun = { frames: ListFrame[]; initial: string[] };

export type ListDrag = {
  /** The rows, as a selector inside the editor's shadow root. */
  rows: string;
  from: number;
  to: number;
  travel: number;
  hold: number;
};

/**
 * Runs in the page: drags row from to row to over travel ms and holds it there.
 * Playwright sends a dragover only when its mouse moves, so this fires one on
 * every frame at whatever the shadow root hit tests under the pointer.
 */
export function dragListInPage({
  rows: selector,
  from,
  to,
  travel,
  hold,
}: ListDrag) {
  return new Promise<ListDragRun>(resolve => {
    const root = window.document.querySelector('erd-editor')!.shadowRoot!;
    const rows = () => [...root.querySelectorAll<HTMLElement>(selector)];
    const initial = rows();
    const held = initial[from];
    const first = initial[0].getBoundingClientRect();
    const pitch = initial[1].getBoundingClientRect().top - first.top;
    const x = first.left + first.width / 2;
    const frames: ListFrame[] = [];

    // A task posted from a frame callback runs once that frame has painted,
    // so the rects read there are the ones on screen, transitions included.
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      const current = rows();
      frames.push({
        order: current.map(row => row.dataset.id!),
        tops: current.map(row => row.getBoundingClientRect().top),
      });
    };

    held.dispatchEvent(
      new DragEvent('dragstart', { bubbles: true, composed: true })
    );

    let start = 0;
    const tick = (now: number) => {
      start ||= now;
      const elapsed = now - start;
      const progress = Math.min(elapsed / travel, 1);
      const y = first.top + (from + (to - from) * progress + 0.5) * pitch;

      root.elementFromPoint(x, y)?.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: x,
          clientY: y,
        })
      );
      channel.port2.postMessage(null);

      if (elapsed < travel + hold) {
        requestAnimationFrame(tick);
        return;
      }

      held.dispatchEvent(
        new DragEvent('dragend', { bubbles: true, composed: true })
      );
      resolve({ frames, initial: initial.map(row => row.dataset.id!) });
    };

    requestAnimationFrame(tick);
  });
}

/**
 * The frames whose rows, sorted by where they paint, stand in another order
 * than the one they hold. The sort is stable, so a tie keeps the held order:
 * that is the frame a row lands on the slot a pushed row is still leaving.
 */
export function framesOutOfOrder({ frames }: ListDragRun): ListFrame[] {
  return frames.filter(({ order, tops }) => {
    const painted = order
      .map((id, index) => ({ id, top: tops[index] }))
      .sort((a, b) => a.top - b.top)
      .map(({ id }) => id);

    return painted.join() !== order.join();
  });
}

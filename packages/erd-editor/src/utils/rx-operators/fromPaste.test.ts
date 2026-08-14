import { describe, expect, it, vi } from 'vitest';

import { copyAction, Emitter, pasteAction } from '@/utils/emitter';
import { fromPaste } from '@/utils/rx-operators/fromPaste';

describe('fromPaste', () => {
  it('emits the ClipboardEvent of every paste action', () => {
    const emitter = new Emitter();
    const values: ClipboardEvent[] = [];
    const subscription = fromPaste(emitter).subscribe(event =>
      values.push(event)
    );

    const first = new ClipboardEvent('paste');
    const second = new ClipboardEvent('paste');
    emitter.emit(pasteAction({ event: first }));
    emitter.emit(pasteAction({ event: second }));
    subscription.unsubscribe();

    expect(values).toEqual([first, second]);
  });

  it('ignores actions other than paste', () => {
    const emitter = new Emitter();
    const next = vi.fn();
    const subscription = fromPaste(emitter).subscribe(next);

    emitter.emit(copyAction({ event: new ClipboardEvent('copy') }));
    subscription.unsubscribe();

    expect(next).not.toHaveBeenCalled();
  });

  it('detaches the emitter listener on unsubscribe', () => {
    const emitter = new Emitter();
    const next = vi.fn();
    const subscription = fromPaste(emitter).subscribe(next);

    subscription.unsubscribe();
    emitter.emit(pasteAction({ event: new ClipboardEvent('paste') }));

    expect(next).not.toHaveBeenCalled();
  });

  it('gives each subscriber its own emitter registration', () => {
    const emitter = new Emitter();
    const source$ = fromPaste(emitter);
    const first = vi.fn();
    const second = vi.fn();
    const subscriptions = [source$.subscribe(first), source$.subscribe(second)];

    emitter.emit(pasteAction({ event: new ClipboardEvent('paste') }));
    subscriptions[0].unsubscribe();
    emitter.emit(pasteAction({ event: new ClipboardEvent('paste') }));
    subscriptions[1].unsubscribe();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it, vi } from 'vitest';

import { copyAction, Emitter, pasteAction } from '@/utils/emitter';
import { fromCopy } from '@/utils/rx-operators/fromCopy';

describe('fromCopy', () => {
  it('emits the ClipboardEvent of every copy action', () => {
    const emitter = new Emitter();
    const values: ClipboardEvent[] = [];
    const subscription = fromCopy(emitter).subscribe(event =>
      values.push(event)
    );

    const first = new ClipboardEvent('copy');
    const second = new ClipboardEvent('copy');
    emitter.emit(copyAction({ event: first }));
    emitter.emit(copyAction({ event: second }));
    subscription.unsubscribe();

    expect(values).toEqual([first, second]);
  });

  it('ignores actions other than copy', () => {
    const emitter = new Emitter();
    const next = vi.fn();
    const subscription = fromCopy(emitter).subscribe(next);

    emitter.emit(pasteAction({ event: new ClipboardEvent('paste') }));
    subscription.unsubscribe();

    expect(next).not.toHaveBeenCalled();
  });

  it('detaches the emitter listener on unsubscribe', () => {
    const emitter = new Emitter();
    const next = vi.fn();
    const subscription = fromCopy(emitter).subscribe(next);

    subscription.unsubscribe();
    emitter.emit(copyAction({ event: new ClipboardEvent('copy') }));

    expect(next).not.toHaveBeenCalled();
  });

  it('subscribes lazily so nothing is emitted before subscribe', () => {
    const emitter = new Emitter();
    const source$ = fromCopy(emitter);
    const next = vi.fn();

    emitter.emit(copyAction({ event: new ClipboardEvent('copy') }));
    const subscription = source$.subscribe(next);
    subscription.unsubscribe();

    expect(next).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vite-plus/test';

import { createSubject } from '@/helpers/subject';

describe('helpers/subject', () => {
  it('delivers next() values to every subscriber in subscription order', () => {
    const subject = createSubject<number>();
    const calls: string[] = [];

    subject.subscribe(value => calls.push(`a:${value}`));
    subject.subscribe(value => calls.push(`b:${value}`));

    subject.next(1);
    subject.next(2);

    expect(calls).toEqual(['a:1', 'b:1', 'a:2', 'b:2']);
  });

  it('does nothing when next() is called without subscribers', () => {
    const subject = createSubject<string>();
    expect(() => subject.next('noop')).not.toThrow();
  });

  it('is not replayed: subscribers only receive values emitted after subscribing', () => {
    const subject = createSubject<number>();
    const observer = vi.fn();

    subject.next(1);
    subject.subscribe(observer);

    expect(observer).not.toHaveBeenCalled();

    subject.next(2);
    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer).toHaveBeenCalledWith(2);
  });

  it('stops delivering after the returned unsubscribe is called', () => {
    const subject = createSubject<number>();
    const observer = vi.fn();

    const unsubscribe = subject.subscribe(observer);
    subject.next(1);
    unsubscribe();
    subject.next(2);

    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer).toHaveBeenCalledWith(1);
  });

  it('tolerates unsubscribing more than once', () => {
    const subject = createSubject<number>();
    const observer = vi.fn();

    const unsubscribe = subject.subscribe(observer);
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();

    subject.next(1);
    expect(observer).not.toHaveBeenCalled();
  });

  it('deduplicates the same observer reference (Set semantics)', () => {
    const subject = createSubject<number>();
    const observer = vi.fn();

    subject.subscribe(observer);
    subject.subscribe(observer);

    subject.next(1);

    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes the shared reference for a duplicated subscription', () => {
    const subject = createSubject<number>();
    const observer = vi.fn();

    const first = subject.subscribe(observer);
    subject.subscribe(observer);

    first();
    subject.next(1);

    expect(observer).not.toHaveBeenCalled();
  });

  it('registers distinct function instances separately', () => {
    const subject = createSubject<number>();
    const received: number[] = [];
    const make = () => (value: number) => received.push(value);

    subject.subscribe(make());
    subject.subscribe(make());

    subject.next(7);

    expect(received).toEqual([7, 7]);
  });

  it('passes the emitted value through by reference', () => {
    const subject = createSubject<{ id: number }>();
    const payload = { id: 1 };
    const observer = vi.fn();

    subject.subscribe(observer);
    subject.next(payload);

    expect(observer.mock.calls[0][0]).toBe(payload);
  });

  it('asReadonly exposes only subscribe, sharing the same observer set', () => {
    const subject = createSubject<number>();
    const readonlySubject = subject.asReadonly();
    const observer = vi.fn();

    expect(Object.keys(readonlySubject)).toEqual(['subscribe']);
    expect((readonlySubject as any).next).toBeUndefined();
    expect(readonlySubject.subscribe).toBe(subject.subscribe);

    const unsubscribe = readonlySubject.subscribe(observer);
    subject.next(3);
    expect(observer).toHaveBeenCalledWith(3);

    unsubscribe();
    subject.next(4);
    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('returns a new readonly wrapper on every call', () => {
    const subject = createSubject<number>();
    expect(subject.asReadonly()).not.toBe(subject.asReadonly());
  });

  it('keeps subjects independent from one another', () => {
    const a = createSubject<number>();
    const b = createSubject<number>();
    const observerA = vi.fn();
    const observerB = vi.fn();

    a.subscribe(observerA);
    b.subscribe(observerB);

    a.next(1);

    expect(observerA).toHaveBeenCalledTimes(1);
    expect(observerB).not.toHaveBeenCalled();
  });

  it('propagates a subscriber error and skips the remaining subscribers', () => {
    const subject = createSubject<number>();
    const later = vi.fn();

    subject.subscribe(() => {
      throw new Error('boom');
    });
    subject.subscribe(later);

    expect(() => subject.next(1)).toThrowError('boom');
    expect(later).not.toHaveBeenCalled();
  });
});

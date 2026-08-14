import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fromShadowDraggable } from '@/utils/rx-operators/fromShadowDraggable';

const createElement = (id: string) => {
  const el = document.createElement('div');
  el.id = id;
  return el;
};

const dragover = (el: Element) => {
  el.dispatchEvent(new DragEvent('dragover'));
};

const dragend = (el: Element) => {
  el.dispatchEvent(new DragEvent('dragend'));
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fromShadowDraggable', () => {
  it('emits the prepared value of the element being dragged over', () => {
    const a = createElement('a');
    const b = createElement('b');
    const prepare = vi.fn((el: HTMLElement) => ({ id: el.id }));
    const values: Array<{ id: string }> = [];
    const subscription = fromShadowDraggable([a, b], prepare).subscribe(value =>
      values.push(value)
    );

    dragover(a);
    vi.advanceTimersByTime(50);
    dragover(b);
    vi.advanceTimersByTime(50);
    subscription.unsubscribe();

    expect(values).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(prepare).toHaveBeenNthCalledWith(1, a);
    expect(prepare).toHaveBeenNthCalledWith(2, b);
  });

  it('does not prepare a throttled dragover', () => {
    const a = createElement('a');
    const prepare = vi.fn((el: HTMLElement) => el.id);
    const values: string[] = [];
    const subscription = fromShadowDraggable([a], prepare).subscribe(value =>
      values.push(value)
    );

    dragover(a);
    vi.advanceTimersByTime(20);
    dragover(a);
    vi.advanceTimersByTime(30);

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(values).toEqual(['a']);

    subscription.unsubscribe();
  });

  it('completes on dragend and ignores later dragover events', () => {
    const a = createElement('a');
    const b = createElement('b');
    const prepare = vi.fn((el: HTMLElement) => el.id);
    const values: string[] = [];
    const complete = vi.fn();
    const subscription = fromShadowDraggable([a, b], prepare).subscribe({
      next: value => values.push(value),
      complete,
    });

    dragover(b);
    vi.advanceTimersByTime(50);
    dragend(a);

    expect(complete).toHaveBeenCalledOnce();
    expect(subscription.closed).toBe(true);

    vi.advanceTimersByTime(1000);
    dragover(b);
    vi.advanceTimersByTime(50);

    expect(values).toEqual(['b']);
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('completes immediately when there is no element', () => {
    const prepare = vi.fn((el: HTMLElement) => el.id);
    const next = vi.fn();
    const complete = vi.fn();
    fromShadowDraggable([], prepare).subscribe({ next, complete });

    expect(next).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledOnce();
  });
});

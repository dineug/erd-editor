import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { fromDraggable } from '@/utils/rx-operators/fromDraggable';

const dragover = (el: Element) => {
  const event = new DragEvent('dragover');
  el.dispatchEvent(event);
  return event;
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

describe('fromDraggable', () => {
  it('debounces the dragover events of every element by 50ms', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const values: DragEvent[] = [];
    const subscription = fromDraggable([a, b]).subscribe(event =>
      values.push(event)
    );

    const first = dragover(a);
    expect(values).toEqual([]);

    vi.advanceTimersByTime(50);
    expect(values).toEqual([first]);

    const fromB = dragover(b);
    vi.advanceTimersByTime(50);
    expect(values).toEqual([first, fromB]);

    subscription.unsubscribe();
  });

  it('throttles the dragover events of one element to one per 300ms', () => {
    const a = document.createElement('div');
    const values: DragEvent[] = [];
    const subscription = fromDraggable([a]).subscribe(event =>
      values.push(event)
    );

    const first = dragover(a);
    vi.advanceTimersByTime(20);
    dragover(a);
    vi.advanceTimersByTime(30);
    expect(values).toEqual([first]);

    vi.advanceTimersByTime(300);
    const second = dragover(a);
    vi.advanceTimersByTime(50);
    expect(values).toEqual([first, second]);

    subscription.unsubscribe();
  });

  it('completes on the first dragend of any element', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const values: DragEvent[] = [];
    const complete = vi.fn();
    const subscription = fromDraggable([a, b]).subscribe({
      next: event => values.push(event),
      complete,
    });

    const first = dragover(a);
    vi.advanceTimersByTime(50);
    dragend(b);

    expect(complete).toHaveBeenCalledOnce();
    expect(subscription.closed).toBe(true);

    vi.advanceTimersByTime(1000);
    dragover(a);
    vi.advanceTimersByTime(50);

    expect(values).toEqual([first]);
  });

  it('drops a pending debounced value when dragend arrives first', () => {
    const a = document.createElement('div');
    const values: DragEvent[] = [];
    const complete = vi.fn();
    fromDraggable([a]).subscribe({
      next: event => values.push(event),
      complete,
    });

    dragover(a);
    vi.advanceTimersByTime(10);
    dragend(a);
    vi.advanceTimersByTime(100);

    expect(values).toEqual([]);
    expect(complete).toHaveBeenCalledOnce();
  });

  it('completes immediately when there is no element', () => {
    const complete = vi.fn();
    const next = vi.fn();
    fromDraggable([]).subscribe({ next, complete });

    expect(next).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledOnce();
  });
});

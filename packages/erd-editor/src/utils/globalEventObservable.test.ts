import { firstValueFrom, take, toArray } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  animationFrames$,
  drag$,
  DragMove,
  keyup$,
  mousedown$,
  mousemove$,
  mouseup$,
  move$,
  moveEnd$,
  moveStart$,
  touchend$,
  touchmove$,
  touchstart$,
} from '@/utils/globalEventObservable';
import { forwardMoveStartEvent } from '@/utils/internalEvents';

const touch = (type: string, points: Array<{ x: number; y: number }>) =>
  new TouchEvent(type, {
    touches: points.map(({ x, y }) => ({
      clientX: x,
      clientY: y,
    })) as any,
  });

const mouse = (type: string, x: number, y: number) =>
  new MouseEvent(type, { clientX: x, clientY: y });

/** Resets the module level prevX / prevY through the moveStart$ subscription. */
const anchor = (x: number, y: number) => {
  window.dispatchEvent(mouse('mousedown', x, y));
};

describe('window event streams', () => {
  it('keyup$ emits the dispatched KeyboardEvent', () => {
    const values: KeyboardEvent[] = [];
    const subscription = keyup$.subscribe(event => values.push(event));
    const event = new KeyboardEvent('keyup', { key: 'Escape' });

    window.dispatchEvent(event);
    subscription.unsubscribe();
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));

    expect(values).toEqual([event]);
  });

  it('mouse streams emit their matching window events', () => {
    const down: MouseEvent[] = [];
    const moveValues: MouseEvent[] = [];
    const up: MouseEvent[] = [];
    const subscriptions = [
      mousedown$.subscribe(e => down.push(e)),
      mousemove$.subscribe(e => moveValues.push(e)),
      mouseup$.subscribe(e => up.push(e)),
    ];

    window.dispatchEvent(mouse('mousedown', 1, 1));
    window.dispatchEvent(mouse('mousemove', 2, 2));
    window.dispatchEvent(mouse('mouseup', 3, 3));
    subscriptions.forEach(subscription => subscription.unsubscribe());

    expect(down).toHaveLength(1);
    expect(moveValues).toHaveLength(1);
    expect(up).toHaveLength(1);
    expect(up[0].clientX).toBe(3);
  });

  it('touch streams emit their matching window events', () => {
    const start: TouchEvent[] = [];
    const moveValues: TouchEvent[] = [];
    const end: TouchEvent[] = [];
    const subscriptions = [
      touchstart$.subscribe(e => start.push(e)),
      touchmove$.subscribe(e => moveValues.push(e)),
      touchend$.subscribe(e => end.push(e)),
    ];

    window.dispatchEvent(touch('touchstart', [{ x: 1, y: 1 }]));
    window.dispatchEvent(touch('touchmove', [{ x: 2, y: 2 }]));
    window.dispatchEvent(touch('touchend', []));
    subscriptions.forEach(subscription => subscription.unsubscribe());

    expect(start).toHaveLength(1);
    expect(moveValues).toHaveLength(1);
    expect(end).toHaveLength(1);
  });
});

describe('animationFrames$', () => {
  it('emits animation frame timestamps', async () => {
    const frames = await firstValueFrom(
      animationFrames$.pipe(take(2), toArray())
    );

    expect(frames).toHaveLength(2);
    expect(typeof frames[0].elapsed).toBe('number');
    expect(frames[1].elapsed).toBeGreaterThanOrEqual(frames[0].elapsed);
  });
});

describe('moveStart$', () => {
  it('merges mousedown, touchstart and the forwarded move start event', () => {
    const values: Array<MouseEvent | TouchEvent> = [];
    const subscription = moveStart$.subscribe(event => values.push(event));

    const down = mouse('mousedown', 5, 6);
    const start = touch('touchstart', [{ x: 7, y: 8 }]);
    const originEvent = mouse('mousedown', 9, 10);
    window.dispatchEvent(down);
    window.dispatchEvent(start);
    window.dispatchEvent(forwardMoveStartEvent({ originEvent }));
    subscription.unsubscribe();

    expect(values).toEqual([down, start, originEvent]);
  });
});

describe('moveEnd$', () => {
  it('merges mouseup and touchend', () => {
    const values: Array<MouseEvent | TouchEvent> = [];
    const subscription = moveEnd$.subscribe(event => values.push(event));

    const up = mouse('mouseup', 1, 2);
    const end = touch('touchend', []);
    window.dispatchEvent(up);
    window.dispatchEvent(end);
    subscription.unsubscribe();

    expect(values).toEqual([up, end]);
  });
});

describe('move$', () => {
  it('reports the movement of a mouse move relative to the move start', () => {
    anchor(10, 20);
    const values: DragMove[] = [];
    const subscription = move$.subscribe(value => values.push(value));

    window.dispatchEvent(mouse('mousemove', 15, 25));
    window.dispatchEvent(mouse('mousemove', 20, 40));
    subscription.unsubscribe();

    expect(values).toHaveLength(2);
    expect(values[0]).toMatchObject({
      x: 15,
      y: 25,
      movementX: 5,
      movementY: 5,
    });
    expect(values[1]).toMatchObject({
      x: 20,
      y: 40,
      movementX: 5,
      movementY: 15,
    });
    expect(values[1].event.type).toBe('mousemove');
  });

  it('tracks a single finger touch move and ignores multi touch', () => {
    window.dispatchEvent(touch('touchstart', [{ x: 100, y: 200 }]));
    const values: DragMove[] = [];
    const subscription = move$.subscribe(value => values.push(value));

    window.dispatchEvent(
      touch('touchmove', [
        { x: 110, y: 220 },
        { x: 0, y: 0 },
      ])
    );
    window.dispatchEvent(touch('touchmove', [{ x: 110, y: 220 }]));
    subscription.unsubscribe();

    expect(values).toHaveLength(1);
    expect(values[0]).toMatchObject({
      x: 110,
      y: 220,
      movementX: 10,
      movementY: 20,
    });
    expect(values[0].event.type).toBe('touchmove');
  });
});

describe('drag$', () => {
  it('emits while moving and completes on mouseup', () => {
    anchor(0, 0);
    const values: DragMove[] = [];
    const complete = vi.fn();
    const subscription = drag$.subscribe({
      next: value => values.push(value),
      complete,
    });

    window.dispatchEvent(mouse('mousemove', 4, 8));
    window.dispatchEvent(mouse('mouseup', 4, 8));
    window.dispatchEvent(mouse('mousemove', 40, 80));

    expect(values).toHaveLength(1);
    expect(values[0]).toMatchObject({ movementX: 4, movementY: 8 });
    expect(complete).toHaveBeenCalledOnce();
    expect(subscription.closed).toBe(true);
  });

  it('completes on touchend as well', () => {
    window.dispatchEvent(touch('touchstart', [{ x: 0, y: 0 }]));
    const complete = vi.fn();
    const subscription = drag$.subscribe({ complete });

    window.dispatchEvent(touch('touchend', []));

    expect(complete).toHaveBeenCalledOnce();
    subscription.unsubscribe();
  });
});

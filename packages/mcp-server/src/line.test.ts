import { Effect, Fiber } from 'effect';
import { describe, expect, it } from 'vite-plus/test';

import { makeLine } from '@/session/line';

/** Starts waiting for place's turn and records when it comes. */
function wait(line: ReturnType<typeof makeLine>, place: number, log: number[]) {
  return Effect.runFork(
    line.turn(place).pipe(Effect.andThen(Effect.sync(() => log.push(place))))
  );
}

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('a line of places', () => {
  it('lets the first place through at once and holds the next until it settles', async () => {
    const line = makeLine();
    const log: number[] = [];
    const [first, second] = [line.take(), line.take()];

    wait(line, first, log);
    wait(line, second, log);
    await tick();
    expect(log).toEqual([first]);
    expect(line.idle()).toBe(false);

    line.settle(first);
    await tick();
    expect(log).toEqual([first, second]);
    line.settle(second);
    expect(line.idle()).toBe(true);
  });

  it('keeps a place waiting until every earlier one settled, in whatever order they did', async () => {
    const line = makeLine();
    const log: number[] = [];
    const places = [line.take(), line.take(), line.take(), line.take()];

    wait(line, places[3], log);
    wait(line, places[2], log);
    line.settle(places[1]);
    line.settle(places[1]);
    await tick();
    expect(log).toEqual([]);

    line.settle(places[0]);
    await tick();
    expect(log).toEqual([places[2]]);
    line.settle(places[0]);
    line.settle(places[2]);
    await tick();
    expect(log).toEqual([places[2], places[3]]);
  });

  it('stops waiting for a place whose holder was interrupted, and lets later ones by once it settles', async () => {
    const line = makeLine();
    const log: number[] = [];
    const places = [line.take(), line.take(), line.take()];

    const gone = wait(line, places[1], log);
    wait(line, places[2], log);
    await Effect.runPromise(Fiber.interrupt(gone));
    line.settle(places[1]);
    line.settle(places[0]);
    await tick();

    expect(log).toEqual([places[2]]);
  });
});

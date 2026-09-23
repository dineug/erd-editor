import * as Effect from 'effect/Effect';

/**
 * Places handed out in order, each let through once every earlier one has
 * settled. A holder settles its place when it is done with the line or when
 * it ends, interrupted or not, so a place is never waited on forever.
 */
export type Line = {
  /** The next place, taken at once. */
  readonly take: () => number;
  /** Succeeds once every earlier place has settled; waiting can be interrupted. */
  readonly turn: (place: number) => Effect.Effect<void>;
  /** Lets the places behind this one move up; settling a place twice does nothing. */
  readonly settle: (place: number) => void;
  /** Every place taken has settled. */
  readonly idle: () => boolean;
};

export function makeLine(): Line {
  let taken = 0;
  /** Every place below it has settled. */
  let front = 0;
  const settled = new Set<number>();
  const waiting = new Map<number, () => void>();

  return {
    take: () => taken++,
    turn: place =>
      Effect.callback<void>(resume => {
        if (place <= front) return resume(Effect.void);
        waiting.set(place, () => resume(Effect.void));
        return Effect.sync(() => void waiting.delete(place));
      }),
    settle: place => {
      if (place < front || settled.has(place)) return;
      settled.add(place);
      while (settled.delete(front)) front++;
      for (const [waiter, wake] of waiting) {
        if (waiter > front) continue;
        waiting.delete(waiter);
        wake();
      }
    },
    idle: () => front === taken,
  };
}

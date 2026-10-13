/** Which entity of the saved document stands for which of the current one, both ways. */
export type Pairing = {
  /** A saved id to the current id it pairs with. */
  toNext: Map<string, string>;
  /** A current id to the saved id it pairs with. */
  toPrev: Map<string, string>;
};

export const emptyPairing = (): Pairing => ({
  toNext: new Map(),
  toPrev: new Map(),
});

/**
 * A key two entities pair on, read on either side: a saved entity spells the
 * ids it refers to as the current ones they pair with, so equal keys mean the
 * same thing. Null for an entity the key cannot pair, an unnamed one say.
 */
export type PairKey<T> = (item: T, side: 'prev' | 'next') => string | null;

function link(pairing: Pairing, prevId: string, nextId: string) {
  pairing.toNext.set(prevId, nextId);
  pairing.toPrev.set(nextId, prevId);
}

/**
 * Pairs two lists one to one: by id first, then by each key in turn, the
 * saved entities taken in document order each pairing with the first current
 * one left that has its key, so a rerun pairs the same way.
 *
 * @example
 * pairEntities(prevTables, nextTables, [table => table.name.trim() ? table.name : null]);
 */
export function pairEntities<T extends { id: string }>(
  prev: ReadonlyArray<T>,
  next: ReadonlyArray<T>,
  keys: ReadonlyArray<PairKey<T>> = []
): Pairing {
  const pairing = emptyPairing();
  const nextIds = new Set(next.map(({ id }) => id));

  for (const { id } of prev) {
    nextIds.has(id) && link(pairing, id, id);
  }

  for (const key of keys) {
    const waiting = new Map<string, T[]>();
    for (const item of next) {
      if (pairing.toPrev.has(item.id)) continue;
      const value = key(item, 'next');
      if (value === null) continue;
      const list = waiting.get(value);
      list ? list.push(item) : waiting.set(value, [item]);
    }

    for (const item of prev) {
      if (pairing.toNext.has(item.id)) continue;
      const value = key(item, 'prev');
      const match = value === null ? undefined : waiting.get(value)?.shift();
      match && link(pairing, item.id, match.id);
    }
  }

  return pairing;
}

/**
 * Pairs what is left by the most members two entities share, for those a key
 * cannot name, such as table groups with no name: the saved ones in document
 * order, each taking the current one it shares the most with, ties the first.
 */
export function pairByOverlap<T extends { id: string }>(
  pairing: Pairing,
  prev: ReadonlyArray<T>,
  next: ReadonlyArray<T>,
  membersOf: (item: T, side: 'prev' | 'next') => ReadonlyArray<string>
): void {
  const open = next.filter(({ id }) => !pairing.toPrev.has(id));

  for (const item of prev) {
    if (pairing.toNext.has(item.id)) continue;
    const members = new Set(membersOf(item, 'prev'));
    if (!members.size) continue;

    let best: T | null = null;
    let most = 0;
    for (const candidate of open) {
      if (pairing.toPrev.has(candidate.id)) continue;
      const shared = membersOf(candidate, 'next').filter(id =>
        members.has(id)
      ).length;
      if (shared > most) {
        best = candidate;
        most = shared;
      }
    }
    best && link(pairing, item.id, best.id);
  }
}

/**
 * The positions of the longest run two sequences share in order, as the
 * indexes of the second one, so an entry outside it is one that moved.
 */
export function longestCommonIndexes(
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>
): Set<number> {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint32Array(rows * cols);

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * cols + j] =
        a[i] === b[j]
          ? table[(i + 1) * cols + j + 1] + 1
          : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
    }
  }

  const kept = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      kept.add(j);
      i++;
      j++;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return kept;
}

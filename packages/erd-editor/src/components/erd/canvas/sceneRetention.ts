export type RetentionOptions = {
  /** Hidden tables kept per drawn table. */
  perDrawn: number;
  /** The fewest kept however little is drawn. */
  atLeast: number;
};

/**
 * Three hidden per drawn. Building a table costs about twelve milliseconds and
 * a fast pan builds dozens a frame, while konva walks every built node, hidden
 * or not, on each scroll; this is the trade between the two that measured best.
 */
export const RETAINED_PER_DRAWN = 3;

/** Kept even where nothing is drawn, so crossing an empty stretch keeps the pool. */
export const RETAINED_AT_LEAST = 16;

export type RetentionPool = {
  /**
   * The ids to keep built but hidden this render: what left the drawn set most
   * recently, up to the bound, and never a table the document no longer holds.
   */
  retain(
    drawnIds: ReadonlySet<string>,
    presentIds: ReadonlySet<string>
  ): ReadonlySet<string>;
};

/**
 * Remembers which tables scrolled off so the scene hides them instead of
 * destroying them, and a scroll back finds them built. Each call is one render:
 * it takes what is drawn now and answers what to keep beside it.
 *
 * @example
 * const retention = createRetentionPool();
 * const retainedIds = retention.retain(drawnIds, new Set(tableIds));
 */
export function createRetentionPool({
  perDrawn = RETAINED_PER_DRAWN,
  atLeast = RETAINED_AT_LEAST,
}: Partial<RetentionOptions> = {}): RetentionPool {
  // Insertion order is age: a table goes to the back each time it leaves.
  const retained = new Set<string>();
  let lastDrawn: ReadonlySet<string> = new Set();

  return {
    retain(drawnIds, presentIds) {
      for (const id of lastDrawn) {
        if (!drawnIds.has(id) && presentIds.has(id)) {
          retained.delete(id);
          retained.add(id);
        }
      }

      for (const id of retained) {
        if (drawnIds.has(id) || !presentIds.has(id)) retained.delete(id);
      }

      const bound = Math.max(atLeast, perDrawn * drawnIds.size);
      for (const id of retained) {
        if (retained.size <= bound) break;
        retained.delete(id);
      }

      lastDrawn = drawnIds;

      return new Set(retained);
    },
  };
}

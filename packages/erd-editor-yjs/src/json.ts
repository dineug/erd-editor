/**
 * A deep copy through JSON, so a value the Y.Doc holds is never one a store
 * keeps a reference into, which a later write would change in place.
 */
export const copyJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Whether a value read off the Y.Doc or an Awareness state is an object, an array among them. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

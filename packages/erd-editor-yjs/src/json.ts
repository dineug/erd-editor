/**
 * A deep copy through JSON, so a value the Y.Doc holds is never one a store
 * keeps a reference into, which a later write would change in place.
 */
export const copyJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/**
 * Last write wins
 * @example
 * Record<uuid, [tag, add, remove, Record<path, version>]>
 */
export type LWW = Record<string, LWWTuple>;

export type LWWTuple = [string, number, number, Record<string, number>];

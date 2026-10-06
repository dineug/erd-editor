import type { DeepPartial } from '@/internal-types';

type Entries = Record<string, unknown>;

const isMergeable = (value: unknown): value is object =>
  typeof value === 'object' && value !== null;

/** The in operator throws on a primitive, which counts here as no key. */
const hasKey = (target: unknown, key: string): boolean =>
  isMergeable(target) && key in target;

/**
 * A key the target reaches only through its prototype, or holds as
 * non-enumerable, is never written. Over a primitive or null-prototype target
 * a parsed __proto__ key still swaps the copy's prototype, as in deepmerge.
 */
const isUnsafeKey = (target: unknown, key: string): boolean =>
  hasKey(target, key) &&
  !Object.prototype.propertyIsEnumerable.call(target, key);

const clone = (value: unknown): unknown =>
  isMergeable(value) ? merge(Array.isArray(value) ? [] : {}, value) : value;

function mergeObject(target: unknown, source: Entries): Entries {
  const destination: Entries = {};

  if (isMergeable(target)) {
    for (const key of Object.keys(target)) {
      destination[key] = clone((target as Entries)[key]);
    }
  }

  for (const key of Object.keys(source)) {
    if (isUnsafeKey(target, key)) continue;

    destination[key] =
      hasKey(target, key) && isMergeable(source[key])
        ? merge((target as Entries)[key], source[key])
        : clone(source[key]);
  }

  return destination;
}

function merge(target: unknown, source: unknown): unknown {
  const sourceIsArray = Array.isArray(source);

  if (sourceIsArray !== Array.isArray(target)) return clone(source);

  return sourceIsArray
    ? (target as unknown[]).concat(source).map(clone)
    : mergeObject(target, source as Entries);
}

/**
 * Merges source over a deep copy of target: objects key by key, arrays target
 * first then source, every object and array in the result a fresh copy, and a
 * key source holds as undefined overwriting target's.
 */
export function deepMerge<T extends object>(
  target: T,
  source: DeepPartial<T>
): T {
  return merge(target, source) as T;
}

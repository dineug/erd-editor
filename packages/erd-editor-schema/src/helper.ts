import { isNumber, isString } from 'es-toolkit';

import { DeepPartial } from '@/internal-types';

export function assign<T extends object, K extends keyof T>(
  valid: (value: any) => boolean,
  target: T,
  source?: DeepPartial<T>
) {
  return (key: K) => {
    if (!source) return;
    const value = (source as Partial<T>)[key];

    if (valid(value)) {
      target[key] = value as Required<T>[K];
    }
  };
}

export function validString(list: ReadonlyArray<string>) {
  return (value: any) => isString(value) && list.includes(value);
}

export function validNumber(list: ReadonlyArray<number>) {
  return (value: any) => isNumber(value) && list.includes(value);
}

export function propOr<T extends object, P extends string | number | symbol, R>(
  target: T,
  propertyKey: P,
  defaultValue: R
): P extends keyof T ? T[P] : R {
  return (Reflect.get(target, propertyKey) as unknown as any) ?? defaultValue;
}

/**
 * The sequence a parse keeps beside an id list: the saved one while it holds
 * every listed id, else the list itself, since a re-add sorts an id missing
 * from the sequence past every other and so reorders the live ones.
 */
export function restoreSequence(
  ids: ReadonlyArray<string>,
  seqIds: string[]
): string[] {
  const seq = new Set(seqIds);
  return ids.every(id => seq.has(id)) ? seqIds : [...ids];
}

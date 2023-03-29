import { isNumber, isString } from '@dineug/shared';

import { DeepPartial } from '@/internal-types';

export function assign<T extends Object, K extends keyof T>(
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

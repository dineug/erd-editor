import { isNumber, isString } from '@dineug/shared';
import { DateTime } from 'luxon';

import { DeepPartial, EntityMeta } from '@/internal-types';

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

export function propOr<T extends object, P extends string | number | symbol, R>(
  target: T,
  propertyKey: P,
  defaultValue: R
): P extends keyof T ? T[P] : R {
  return (Reflect.get(target, propertyKey) as unknown as any) ?? defaultValue;
}

export function getDefaultEntityMeta(): EntityMeta {
  const now = DateTime.now().toISO() ?? '';
  return {
    updateAt: now,
    createAt: now,
    deleted: 0,
  };
}

export function assignMeta(
  target: EntityMeta,
  source?: DeepPartial<EntityMeta>
) {
  const assignString = assign(isString, target, source);
  const assignNumber = assign(isNumber, target, source);

  assignString('updateAt');
  assignString('createAt');
  assignNumber('deleted');
}

import { isNumber, isString } from '@dineug/shared';

import { DeepPartial, EntityMeta } from '@/internal-types';

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

export function getDefaultEntityMeta(): EntityMeta {
  const now = Date.now();
  return {
    updateAt: now,
    createAt: now,
  };
}

export function assignMeta(
  target: EntityMeta,
  source?: DeepPartial<EntityMeta>
) {
  const assignNumber = assign(isNumber, target, source);

  assignNumber('updateAt');
  assignNumber('createAt');
}

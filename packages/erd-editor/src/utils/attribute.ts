import { isNill } from '@dineug/shared';

export function restAttrs(value: Record<string, any>) {
  return Object.keys(value).reduce((acc, key) => {
    const result = Reflect.get(value, key);

    if (!isNill(result) && result !== '') {
      Reflect.set(acc, key, result);
    }

    return acc;
  }, {} as Record<string, any>);
}

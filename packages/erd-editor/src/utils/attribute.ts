import { isNil } from 'es-toolkit';

export function restAttrs(value: Record<string, any>) {
  return Object.keys(value).reduce(
    (acc, key) => {
      const result = Reflect.get(value, key);

      if (!isNil(result) && result !== '') {
        Reflect.set(acc, key, result);
      }

      return acc;
    },
    {} as Record<string, any>
  );
}

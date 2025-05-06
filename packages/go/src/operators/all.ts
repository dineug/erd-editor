import { go } from '@/go';

type AwaitedArray<T> = { [P in keyof T]: Awaited<T[P]> };

export const all = <T extends readonly unknown[] | []>(values: T) =>
  go(function* () {
    const result: AwaitedArray<T> = yield values;
    return result;
  });

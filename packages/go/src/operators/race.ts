import { isPromise, isPromiseLike } from '@/is-type';

type Key = string | number | symbol;
type RaceRecord = Record<Key, unknown>;
type AwaitedRecord<T extends RaceRecord, K extends keyof T = keyof T> = {
  [P in K]: Awaited<T[P]>;
};
type PAR<T extends RaceRecord> = Partial<AwaitedRecord<T>>;

export const race = <T extends RaceRecord>(record: T) =>
  new Promise<PAR<T>>((resolve, reject) => {
    const toResolve = (key: Key) => (value: any) =>
      resolve({ [key]: value } as PAR<T>);

    for (const [key, entry] of Object.entries(record)) {
      isPromise(entry)
        ? entry.then(toResolve(key)).catch(reject)
        : isPromiseLike(entry)
          ? entry.then(toResolve(key))
          : toResolve(key)(entry);
    }
  });

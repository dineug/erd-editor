import {
  isArray,
  isFunction,
  isGenerator,
  isIterator,
  isPromiseLike,
} from '@/is-type';
import {
  type AnyCallback,
  attachCancel,
  CANCEL,
  cancel,
  isCancel,
  isKill,
} from '@/operators';

export type CompositionGenerator<T> =
  | Generator<T | CompositionGenerator<T>>
  | AsyncGenerator<T | CompositionGenerator<T>>;

export type CompositionPromise<T = any> = Promise<T> | PromiseLike<T>;

export type CoroutineCreator = (
  ...args: any[]
) => CompositionGenerator<
  CompositionPromise<any> | Function | Array<any> | void
>;

export type CO = CoroutineCreator;

type GoReturnType<
  F extends AnyCallback,
  R extends ReturnType<F> = ReturnType<F>,
> =
  R extends Promise<any>
    ? Awaited<R>
    : R extends Iterator<any, infer IR> | Generator<any, infer IR>
      ? IR
      : R extends AsyncIterator<any, infer AIR> | AsyncGenerator<any, infer AIR>
        ? Awaited<AIR>
        : R;

export function go<F extends AnyCallback>(
  callback: F,
  ...args: Parameters<F>
): Promise<GoReturnType<F>> {
  let canceled = false;
  let cancelAndReject: AnyCallback | null = null;

  // eslint-disable-next-line no-async-promise-executor
  const promise = new Promise(async (resolve, reject) => {
    let process: Array<CompositionPromise<any>> | null = null;
    cancelAndReject = () => {
      reject(CANCEL);
      process?.forEach(cancel);
      process = null;
    };

    try {
      const co = callback(...args);
      if (isPromiseLike(co)) {
        process = [co];
        return resolve(await co);
      } else if (!isIterator(co)) {
        return resolve(co);
      }

      let result = await co.next();
      let value;

      while (!canceled && !result.done) {
        try {
          const next = toNext(result.value);
          process = isArray(next) ? next : [next];
          value = await (isArray(next) ? Promise.all(next) : next);
          result = await co.next(value);
        } catch (error) {
          if (isKill(error)) {
            throw error;
          }

          if (isGenerator(co)) {
            result = await co.throw(error);
          }
        }

        value = undefined;
        process = null;
      }

      resolve(result.value);
    } catch (error) {
      if (isCancel(error)) {
        canceled = true;
      }
      reject(error);
    }
  }) as Promise<GoReturnType<F>>;

  // fix: Uncaught (in promise)
  promise.catch(() => {});

  attachCancel(promise, () => {
    canceled = true;
    cancelAndReject?.();
  });

  return promise;
}

function toNext(value: any) {
  return isPromiseLike(value)
    ? value
    : isIterator(value)
      ? go(() => value)
      : isFunction(value)
        ? go(value)
        : isArray(value)
          ? value.map(value => go(() => value))
          : Promise.resolve();
}

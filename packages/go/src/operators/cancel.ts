import { type CompositionPromise, go } from '@/go';
import { isObject } from '@/is-type';

export const CANCEL = Symbol.for('https://github.com/dineug/go.git#cancel');
export const ATTACH_CANCEL = Symbol.for(
  'https://github.com/dineug/go.git#attachCancel'
);

export const attachCancel = <T>(
  promise: Promise<T>,
  cancel: () => void
): Promise<T> => {
  Reflect.set(promise, ATTACH_CANCEL, cancel);
  return promise;
};

export const isCancel = (value: any): value is typeof CANCEL =>
  value === CANCEL;

export const cancel = <T>(promise?: CompositionPromise<T>) => {
  if (isObject<object>(promise)) {
    const cancel = Reflect.get(promise, ATTACH_CANCEL);
    cancel?.();
  }

  return go(() => new Promise<void>((resolve, reject) => reject(CANCEL)));
};

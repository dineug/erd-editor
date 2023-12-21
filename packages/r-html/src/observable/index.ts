import { safeCallback } from '@/helpers/fn';
import { isArray, isObject } from '@/helpers/is-type';
import { createSubject, Subject } from '@/helpers/subject';
import { effect, watchEffect } from '@/observable/scheduler';
import { addHmrObservable } from '@/render/hmr';

export type PropName = string | number | symbol;
export type Observer = () => void;
export type Unsubscribe = () => void;
export type ObservableOptions = {
  shallow: boolean;
};

export const rawToProxy = new WeakMap();
export const rawToObservers = new WeakMap<object, Set<Observer>>();
const proxyToRaw = new WeakMap();
export const proxyToSubject = new WeakMap<object, Subject<PropName>>();
export const observerToTriggers = new WeakMap<
  Observer,
  Map<any, Set<PropName>>
>();

const defaultObservableOptions: ObservableOptions = { shallow: false };

let currentObserver: Observer | null = null;

export function observer(f: Observer): Unsubscribe {
  currentObserver = f;
  safeCallback(f);
  currentObserver = null;

  return () => unobserve(f);
}

export function unobserve(observer: Observer) {
  const triggers = observerToTriggers.get(observer);

  if (triggers) {
    for (const [raw] of triggers.entries()) {
      const observers = rawToObservers.get(raw);
      observers?.delete(observer);
    }
  }

  triggers && observerToTriggers.delete(observer);
}

function addObserver(raw: any) {
  if (!currentObserver) return;

  const observers = rawToObservers.get(raw);

  if (!observers) {
    rawToObservers.set(raw, new Set([currentObserver]));
  } else if (!observers.has(currentObserver)) {
    observers.add(currentObserver);
  }
}

function addTrigger(raw: any, p: PropName) {
  if (!currentObserver) return;

  const triggers = observerToTriggers.get(currentObserver);

  if (triggers) {
    const trigger = triggers.get(raw);

    if (!trigger) {
      triggers.set(raw, new Set([p]));
    } else if (!trigger.has(p)) {
      trigger.add(p);
    }
  } else {
    observerToTriggers.set(currentObserver, new Map([[raw, new Set([p])]]));
  }
}

const exclude = (value: any) =>
  value instanceof Node ||
  value instanceof Map ||
  value instanceof Set ||
  value instanceof WeakMap ||
  value instanceof WeakSet ||
  value instanceof RegExp ||
  value instanceof Date ||
  value instanceof Promise ||
  ((isArray(value) || isObject(value)) && Object.isFrozen(value));

export function observable<T>(
  raw: T,
  options: Partial<ObservableOptions> = {}
): T {
  const { shallow } = Object.assign({}, defaultObservableOptions, options);
  const proxy = new Proxy(raw as any, {
    get(target, p, receiver) {
      const value = Reflect.get(target, p, receiver);
      if (exclude(value)) return value;

      addObserver(raw);
      addTrigger(raw, p);

      if (
        !shallow &&
        (isObject(value) || isArray(value)) &&
        !proxyToRaw.has(value)
      ) {
        return rawToProxy.has(value)
          ? rawToProxy.get(value)
          : observable(value, options);
      }

      return value;
    },
    set(target, p, value, receiver) {
      const oldValue = Reflect.get(target, p, receiver);
      const res = Reflect.set(target, p, value, receiver);
      const isEffect =
        !isArray(target) && oldValue !== value ? true : p === 'length';

      if (isEffect) {
        effect(target, p);
        watchEffect(target, p);
      }

      return res;
    },
    deleteProperty(target, p) {
      const res = Reflect.deleteProperty(target, p);

      effect(target, p);
      watchEffect(target, p);

      return res;
    },
  });

  rawToProxy.set(raw as any, proxy);
  proxyToRaw.set(proxy, raw);
  addHmrObservable(proxy);

  return proxy;
}

export function watch(proxy: any) {
  const subject =
    proxyToSubject.get(proxy) ??
    (proxyToSubject
      .set(proxy, createSubject())
      .get(proxy) as Subject<PropName>);

  return subject.asReadonly();
}

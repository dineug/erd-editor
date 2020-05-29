import { Subject, Subscription, asapScheduler } from "rxjs";
import { Logger } from "./Logger";
import { isObject, isFunction } from "./Helper";

let proxyCount = 0;

interface RefTrigger {
  ref: object;
  keys: [string | number | symbol];
}

const rawToProxy = new WeakMap();
const rawToRefTriggers = new WeakMap<object, Array<RefTrigger>>();
const refToUpdate = new WeakMap<object, Function>();
const refToTask = new WeakMap<object, Function>();
const refToRaws = new WeakMap<object, Array<object>>();
const proxyToRaw = new WeakMap();
const proxyToObservable = new WeakMap<
  object,
  Subject<string | number | symbol>
>();

let currentRef: object | null = null;
let currentUpdate: Function | null = null;

export function observeStart<T>(
  ref: object,
  render: () => T,
  update: Function
): T {
  currentRef = ref;
  currentUpdate = update;
  return render();
}
export function observeEnd() {
  currentRef = null;
  currentUpdate = null;
}
export function observe<T>(ref: object, render: () => T, update: Function): T {
  const result = observeStart(ref, render, update);
  observeEnd();
  return result;
}

export function destroyRef(ref: object) {
  const raws = refToRaws.get(ref);
  if (raws) {
    raws.forEach((raw) => {
      const refTriggers = rawToRefTriggers.get(raw);
      if (refTriggers) {
        for (let i = 0; i < refTriggers.length; i++) {
          const refTrigger = refTriggers[i];
          if (refTrigger.ref === ref) {
            refTriggers.splice(i, 1);
            i--;
          }
        }
        if (refTriggers.length === 0) {
          rawToRefTriggers.delete(raw);
        }
      }
    });
  }
  if (refToUpdate.has(ref)) {
    refToUpdate.delete(ref);
  }
  if (refToTask.has(ref)) {
    refToTask.delete(ref);
  }
  if (refToRaws.has(ref)) {
    refToRaws.delete(ref);
  }
}

function observer(raw: any, p: string | number | symbol) {
  if (isObject(currentRef) && isFunction(currentUpdate)) {
    const refTriggers = rawToRefTriggers.get(raw);
    if (refTriggers) {
      if (!refTriggers.some((refTrigger) => refTrigger.ref === currentRef)) {
        refTriggers.push({
          ref: currentRef as object,
          keys: [p],
        });
      } else {
        refTriggers.forEach((refTrigger) => {
          if (
            refTrigger.ref === currentRef &&
            !refTrigger.keys.some((key) => key === p)
          ) {
            refTrigger.keys.push(p);
          }
        });
      }
    } else {
      rawToRefTriggers.set(raw, [
        {
          ref: currentRef as object,
          keys: [p],
        },
      ]);
    }
    refToUpdate.set(currentRef as object, currentUpdate as Function);
    setRefToRaws(currentRef as object, raw);
  }
}

function setRefToRaws(ref: object, newRaw: any) {
  const raws = refToRaws.get(ref);
  if (raws) {
    if (!raws.some((raw) => raw === newRaw)) {
      raws.push(newRaw);
    }
  } else {
    refToRaws.set(ref, [newRaw]);
  }
}

function effect(target: any, p: string | number | symbol) {
  const refTriggers = rawToRefTriggers.get(target);
  if (refTriggers) {
    for (let i = 0; i < refTriggers.length; i++) {
      const refTrigger = refTriggers[i];
      if (refTrigger.keys.some((key) => key === p)) {
        const update = refToUpdate.get(refTrigger.ref);
        if (update) {
          new Promise((resolve) => resolve())
            .then(() => {
              refToTask.set(refTrigger.ref, update);
            })
            .then(() => {
              if (refToTask.has(refTrigger.ref)) {
                const task = refToTask.get(refTrigger.ref);
                refToTask.delete(refTrigger.ref);
                if (task) {
                  task();
                }
              }
            });
        }
        refTriggers.splice(i, 1);
        i--;
      }
    }
    if (refTriggers.length === 0) {
      rawToRefTriggers.delete(target);
    }
  }
}

export function createObservable<T>(raw: T, excludeKeys: string[] = []): T {
  const proxy = new Proxy(raw as any, {
    get(target, p) {
      observer(raw, p);
      if (
        isObject(target[p]) &&
        !proxyToRaw.has(target[p]) &&
        !excludeKeys.some((key) => key === p)
      ) {
        if (rawToProxy.has(target[p])) {
          return rawToProxy.get(target[p]);
        }
        return createObservable(target[p], excludeKeys);
      }
      return target[p];
    },
    set(target, p, value) {
      target[p] = value;
      if (Array.isArray(target)) {
        if (p === "length") {
          effectLegacy(target, p);
          effect(target, p);
        }
      } else {
        effectLegacy(target, p);
        effect(target, p);
      }
      return true;
    },
  });
  rawToProxy.set(raw as any, proxy);
  proxyToRaw.set(proxy, raw);
  Logger.debug(`createObservable proxyCount: ${++proxyCount}`, raw);
  return proxy;
}

export function observeLegacy(
  proxy: any,
  observer: (name: string | number | symbol) => void
): Subscription {
  let observable$ = proxyToObservable.get(proxy);
  if (!observable$) {
    observable$ = new Subject();
    proxyToObservable.set(proxy, observable$);
  }
  return observable$.subscribe(observer);
}

function effectLegacy(raw: any, name: string | number | symbol) {
  const proxy = rawToProxy.get(raw);
  if (proxy) {
    const observable$ = proxyToObservable.get(proxy);
    if (observable$) {
      asapScheduler.schedule(() => observable$.next(name));
    }
  }
}

import { Logger } from "./Logger";
import { isObject } from "./Helper";

let proxyCount = 0;

export function createObservable<T>(
  raw: T,
  rawToProxy: WeakMap<object, any>,
  proxyToRaw: WeakMap<object, any>,
  effect: (raw: any, name: string | number | symbol) => void,
  excludeKeys: string[]
): T {
  const proxy = new Proxy(raw as any, {
    get(target, p) {
      if (
        isObject(target[p]) &&
        !proxyToRaw.has(target[p]) &&
        !excludeKeys.some((key) => key === p)
      ) {
        if (rawToProxy.has(target[p])) {
          return rawToProxy.get(target[p]);
        }
        const proxy = createObservable(
          target[p],
          rawToProxy,
          proxyToRaw,
          effect,
          excludeKeys
        );
        return proxy;
      }
      return target[p];
    },
    set(target, p, value) {
      target[p] = value;
      if (Array.isArray(target)) {
        if (p === "length") {
          effect(target, p);
        }
      } else {
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

export function createObservable<T>(
  data: T,
  rawToProxy: WeakMap<object, any>,
  proxyToRaw: WeakMap<object, any>,
  effect: (raw: any, name: string | number | symbol) => void
): T {
  const proxy = new Proxy(data as any, {
    get(target, p) {
      if (target[p] !== null && typeof target[p] === "object") {
        if (rawToProxy.has(target[p])) {
          return rawToProxy.get(target[p]);
        }
        const proxy = createObservable(
          target[p],
          rawToProxy,
          proxyToRaw,
          effect
        );
        return proxy;
      }
      return target[p];
    },
    set(target, p, value) {
      if (Array.isArray(target[p])) {
        const list = target[p].map((item: any) => {
          if (proxyToRaw.has(item)) {
            return proxyToRaw.get(item);
          }
          return item;
        });
        target[p] = list;
      } else {
        if (typeof target[p] === "object" && value === null) {
          if (rawToProxy.has(target[p])) {
            const proxy = rawToProxy.get(target[p]);
            proxyToRaw.delete(proxy);
          }
          rawToProxy.delete(target[p]);
        }
        target[p] = value;
      }
      effect(target, p);
      return true;
    },
  });
  rawToProxy.set(data as any, proxy);
  proxyToRaw.set(proxy, data);
  return proxy;
}

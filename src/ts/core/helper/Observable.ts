export function observable<T>(
  data: T,
  rawToProxy: WeakMap<object, any>,
  proxyToRaw: WeakMap<object, any>,
  effect: (raw: any, field: string | number | symbol) => void
): T {
  return new Proxy(data as any, {
    get(target, p) {
      if (typeof target[p] === "object") {
        if (rawToProxy.has(target[p])) {
          return rawToProxy.get(target[p]);
        }
        const proxy = observable(target[p], rawToProxy, proxyToRaw, effect);
        rawToProxy.set(target[p], proxy);
        proxyToRaw.set(proxy, target[p]);
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
        target[p] = value;
      }
      effect(target, p);
      return true;
    }
  });
}

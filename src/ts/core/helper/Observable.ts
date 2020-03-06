export function useObservable<T>(
  obj: T,
  effect: (
    name: string | number | symbol,
    oldValue: any,
    newValue: any
  ) => void,
  map = new WeakMap(),
  keys: object[] = []
): [T, () => void] {
  return [
    new Proxy(obj as any, {
      get(target, prop) {
        if (typeof target[prop] === "object") {
          if (map.has(target[prop])) {
            return map.get(target[prop]);
          } else {
            const [p] = useObservable(target[prop], effect, map, keys);
            map.set(target[prop], p);
            keys.push(target[prop]);
            return p;
          }
        }
        return target[prop];
      },
      set(target, prop, value) {
        const oldValue = target[prop];
        target[prop] = value;
        effect(prop, oldValue, value);
        return true;
      }
    }),
    () => {
      keys.forEach(key => {
        map.delete(key);
      });
    }
  ];
}

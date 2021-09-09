const isDev = import.meta.env.DEV;

const logger = <A>(actions: any): A =>
  new Proxy(actions, {
    get(target, p, receiver) {
      const f = Reflect.get(target, p, receiver);

      const proxy = (...args: any[]) => {
        const value = f(...args);
        console.log(`action: "${String(p)}"`, 'payload =>', args);
        return value;
      };

      return proxy;
    },
  });

export const createStore =
  <S, A>(state: S, actions: A) =>
  (): [S, A] =>
    [state, isDev ? logger(actions) : actions];

const isDev = import.meta.env.DEV;

const logger = <A>(actions: any, namespace?: string): A =>
  new Proxy(actions, {
    get(target, p, receiver) {
      const f = Reflect.get(target, p, receiver);

      const proxy = (...args: any[]) => {
        const value = f(...args);
        const logs = [`action: "${String(p)}"`, 'payload =>', args];
        namespace && logs.unshift(namespace);
        console.log(...logs);
        return value;
      };

      return proxy;
    },
  });

export const createStore =
  <S, A>(state: S, actions: A, namespace?: string) =>
  (): [S, A] =>
    [state, isDev ? logger(actions, namespace) : actions];

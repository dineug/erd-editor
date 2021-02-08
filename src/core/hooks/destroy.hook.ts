import { unmounted } from '@dineug/lit-observable';

type Callback = () => void;

export function useDestroy() {
  const list: Array<Callback> = [];

  unmounted(() => {
    while (list.length) (list.pop() as Callback)();
  });

  return list;
}

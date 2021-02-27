import { unmounted } from '@dineug/lit-observable';

type Callback = () => void;

export function useUnmounted() {
  const unmountedGroup: Array<Callback> = [];

  unmounted(() => {
    while (unmountedGroup.length) (unmountedGroup.pop() as Callback)();
  });

  return {
    unmountedGroup,
  };
}

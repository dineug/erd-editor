import { unmounted } from '@vuerd/lit-observable';
import { Subscription } from 'rxjs';
import { isFunction } from '@/core/helper';

type Callback = () => void;

export function useUnmounted() {
  const unmountedGroup: Array<Callback | Subscription> = [];

  unmounted(() => {
    while (unmountedGroup.length) {
      const f = unmountedGroup.pop() as Callback | Subscription;
      isFunction(f) ? (f as Callback)() : (f as Subscription).unsubscribe();
    }
  });

  return {
    unmountedGroup,
  };
}

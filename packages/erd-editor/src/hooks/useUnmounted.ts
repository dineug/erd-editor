import { onUnmounted } from '@dineug/r-html';
import { isFunction } from '@dineug/shared';
import { Subscription } from 'rxjs';

import { Unsubscribe } from '@/internal-types';

export function useUnmounted() {
  const unsubscribeSet = new Set<Unsubscribe | Subscription>();

  const addUnsubscribe = (...args: Array<Unsubscribe | Subscription>) => {
    args.forEach(unsubscribe => unsubscribeSet.add(unsubscribe));
  };

  onUnmounted(() => {
    Array.from(unsubscribeSet).forEach(unsubscribe =>
      isFunction(unsubscribe) ? unsubscribe() : unsubscribe.unsubscribe()
    );
    unsubscribeSet.clear();
  });

  return {
    addUnsubscribe,
  };
}

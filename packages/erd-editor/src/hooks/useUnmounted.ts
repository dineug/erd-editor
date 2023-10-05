import { onUnmounted } from '@dineug/r-html';
import { isFunction } from '@dineug/shared';
import { Subscription } from 'rxjs';

import { Unsubscribe } from '@/internal-types';

export function useUnmounted() {
  let unsubscribeList: Array<Unsubscribe | Subscription> = [];

  const addUnsubscribe = (...args: Array<Unsubscribe | Subscription>) => {
    unsubscribeList.push(...args);
  };

  onUnmounted(() => {
    unsubscribeList.forEach(unsubscribe =>
      isFunction(unsubscribe) ? unsubscribe() : unsubscribe.unsubscribe()
    );
    unsubscribeList = [];
  });

  return {
    addUnsubscribe,
  };
}

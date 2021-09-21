import { Subscription } from 'rxjs';
import { onUnmounted } from 'vue';

const unsubscribe = (subscription: Subscription) => subscription.unsubscribe();

export function useUnsubscribe() {
  const subscriptions: Subscription[] = [];

  const push = (...newSubscriptions: Subscription[]) => {
    subscriptions.push(...newSubscriptions);
  };

  onUnmounted(() => {
    subscriptions.forEach(unsubscribe);
  });

  return {
    push,
  };
}

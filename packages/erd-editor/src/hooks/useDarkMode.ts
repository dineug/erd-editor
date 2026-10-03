import { observable, onMounted } from '@dineug/r-html';

import { useUnmounted } from '@/hooks/useUnmounted';

export function useDarkMode() {
  const mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
  const state = observable(
    {
      isDark: mediaQuery.matches,
    },
    { shallow: true }
  );
  const { addUnsubscribe } = useUnmounted();

  const handleChange = (event: MediaQueryListEvent) => {
    state.isDark = event.matches;
  };

  // A reconnected element heard no change while it was out of the document.
  onMounted(() => {
    state.isDark = mediaQuery.matches;
    mediaQuery.addEventListener('change', handleChange);

    addUnsubscribe(() => {
      mediaQuery.removeEventListener('change', handleChange);
    });
  });

  return { state };
}

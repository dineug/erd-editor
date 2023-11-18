import { observable, onMounted } from '@dineug/r-html';

import { useUnmounted } from '@/hooks/useUnmounted';

export function useDarkMode() {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
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

  onMounted(() => {
    mediaQuery.addEventListener('change', handleChange);

    addUnsubscribe(() => {
      mediaQuery.removeEventListener('change', handleChange);
    });
  });

  return { state };
}

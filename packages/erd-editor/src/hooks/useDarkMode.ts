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
  let listening = false;
  let stopped = false;

  const handleChange = (event: MediaQueryListEvent) => {
    state.isDark = event.matches;
  };

  const unlisten = () => {
    if (!listening) return;
    listening = false;
    mediaQuery.removeEventListener('change', handleChange);
  };

  // A reconnected element heard no change while it was out of the document.
  onMounted(() => {
    if (stopped) return;

    state.isDark = mediaQuery.matches;
    mediaQuery.addEventListener('change', handleChange);
    listening = true;
    addUnsubscribe(unlisten);
  });

  return {
    state,
    /** Lets the OS color scheme go now and on every later mount, for an element destroyed while still in a page. */
    stop: () => {
      stopped = true;
      unlisten();
    },
  };
}

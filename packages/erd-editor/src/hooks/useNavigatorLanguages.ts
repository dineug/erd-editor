import { observable, onMounted } from '@dineug/r-html';

import { useUnmounted } from '@/hooks/useUnmounted';

/**
 * Chromium hands out a frozen array, which r-html's observable never tracks, so
 * the state keeps a copy and a render reading it runs again on a change.
 */
const readLanguages = (): string[] => [...window.navigator.languages];

/** The browser's preferred languages, kept up to date by its languagechange event. */
export function useNavigatorLanguages() {
  const state = observable({ languages: readLanguages() }, { shallow: true });
  const { addUnsubscribe } = useUnmounted();

  const handleChange = () => {
    state.languages = readLanguages();
  };

  // A reconnected element heard no change while it was out of the document.
  onMounted(() => {
    state.languages = readLanguages();
    window.addEventListener('languagechange', handleChange);

    addUnsubscribe(() => {
      window.removeEventListener('languagechange', handleChange);
    });
  });

  return { state };
}

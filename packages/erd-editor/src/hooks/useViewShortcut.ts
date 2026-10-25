import { onBeforeMount, onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { Open } from '@/constants/open';
import { ZOOM_RESET, ZOOM_STEP } from '@/constants/zoom';
import {
  changeZoomLevelAction$,
  streamZoomLevelAction$,
} from '@/engine/modules/settings/generator.actions';
import { Ctx } from '@/internal-types';
import { KeyBindingName, pickKeyBindingMap } from '@/utils/keyboard-shortcut';

import { useUnmounted } from './useUnmounted';

/**
 * The chords a read-only view answers: the three zoom chords, and the palette's
 * search and Escape, which the palette answers itself.
 */
export const VIEW_KEY_BINDINGS: ReadonlyArray<KeyBindingName> = [
  KeyBindingName.zoomIn,
  KeyBindingName.zoomOut,
  KeyBindingName.zoomReset,
  KeyBindingName.search,
  KeyBindingName.stop,
];

/**
 * The read-only view's keys. It narrows the app's map to VIEW_KEY_BINDINGS, so
 * useKeyBindingMap binds those alone and every other press goes on to the page
 * unprevented, and zooms on the zoom chords as the editor's canvas does.
 */
export function useViewShortcut(ctx: Ctx) {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();

  const handleShortcut = ({ type }: { type: KeyBindingName }) => {
    const { store } = app.value;

    // A chord typed into the open palette is the palette's, as the editor's
    // canvas leaves it.
    if (store.state.editor.openMap[Open.search]) return;

    type === KeyBindingName.zoomIn &&
      store.dispatch(streamZoomLevelAction$(ZOOM_STEP));
    type === KeyBindingName.zoomOut &&
      store.dispatch(streamZoomLevelAction$(-ZOOM_STEP));
    // Absolute rather than a run of steps, so it holds the middle of the
    // screen the way the reset button does.
    type === KeyBindingName.zoomReset &&
      store.dispatch(changeZoomLevelAction$(ZOOM_RESET));
  };

  // Once the context has resolved and before the binder mounts, which then
  // binds the narrowed map; a binder already mounted rebinds on the change.
  onBeforeMount(() => {
    pickKeyBindingMap(app.value.keyBindingMap, VIEW_KEY_BINDINGS);
  });

  onMounted(() => {
    addUnsubscribe(app.value.shortcut$.subscribe(handleShortcut));
  });
}

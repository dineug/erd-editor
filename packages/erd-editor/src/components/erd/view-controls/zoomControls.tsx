import type { DOMTemplateLiterals } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useI18n } from '@/components/localeContext';
import Icon from '@/components/primitives/icon/Icon';
import { ZOOM_RESET, ZOOM_STEP } from '@/constants/zoom';
import {
  changeZoomLevelAction$,
  streamZoomLevelAction$,
} from '@/engine/modules/settings/generator.actions';
import type { PlainMessageKey } from '@/i18n/translate';
import type { Ctx } from '@/internal-types';
import { KeyBindingName, toShortcutTitle } from '@/utils/keyboard-shortcut';
import { toZoomFormat } from '@/utils/validation';

import * as styles from './viewControls.styles';

const ICON_SIZE = 16;

/**
 * Zoom out, the zoom as a percentage, which puts it back to 100%, and zoom in,
 * over the document of the store the bar stands on. A template rather than a
 * component, so the three stand in the bar's own row and change in its pass.
 */
export function useZoomControls(ctx: Ctx): () => DOMTemplateLiterals {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);

  const handleZoomStep = (step: number) => () => {
    const { store } = app.value;
    store.dispatch(streamZoomLevelAction$(step));
  };

  // Absolute, the way the reset chord is, so it holds the middle of the screen.
  const handleZoomReset = () => {
    const { store } = app.value;
    store.dispatch(changeZoomLevelAction$(ZOOM_RESET));
  };

  return () => {
    const { store, keyBindingMap } = app.value;
    const { t } = i18n.value;
    const title = (labelKey: PlainMessageKey, keyBindingName: KeyBindingName) =>
      toShortcutTitle(keyBindingMap, t(labelKey), keyBindingName);

    return (
      <>
        <div
          class={styles.menu}
          title={title('floatingToolbar.zoomOut', KeyBindingName.zoomOut)}
          on:click={handleZoomStep(-ZOOM_STEP)}
        >
          <Icon name="minus" size={ICON_SIZE} />
        </div>
        <div
          class={['zoom-level', styles.readout]}
          title={title('floatingToolbar.resetZoom', KeyBindingName.zoomReset)}
          on:click={handleZoomReset}
        >
          {toZoomFormat(store.state.settings.zoomLevel)}
        </div>
        <div
          class={styles.menu}
          title={title('floatingToolbar.zoomIn', KeyBindingName.zoomIn)}
          on:click={handleZoomStep(ZOOM_STEP)}
        >
          <Icon name="plus" size={ICON_SIZE} />
        </div>
      </>
    );
  };
}

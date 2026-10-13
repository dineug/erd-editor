import { FC, nextTick, onMounted } from '@dineug/r-html';
import { get } from 'es-toolkit/compat';
import { filter } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import { insetPastExplorer } from '@/components/erd-editor/viewportLayout';
import { useI18n } from '@/components/localeContext';
import Icon from '@/components/primitives/icon/Icon';
import { IconName } from '@/components/primitives/icon/icons';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import type { PlainMessageKey } from '@/i18n/translate';
import {
  AccentColor,
  AccentColorList,
  Appearance,
  AppearanceOption,
  GrayColor,
  GrayColorList,
  Palette,
  SYSTEM_APPEARANCE,
  ThemeOptions,
} from '@/themes/radix-ui-theme';
import { setThemeOptionsAction } from '@/utils/emitter';
import { focusEvent } from '@/utils/internalEvents';
import { KeyBindingName, toShortcutTitle } from '@/utils/keyboard-shortcut';

import * as styles from './ThemeBuilder.styles';

export type ThemeBuilderProps = {
  theme: ThemeOptions;
};

/** The three appearances in the order the builder's buttons and the palette's Theme rows list them. */
export const APPEARANCE_BUTTONS: ReadonlyArray<{
  appearance: AppearanceOption;
  icon: IconName;
  labelKey: PlainMessageKey;
}> = [
  { appearance: SYSTEM_APPEARANCE, icon: 'monitor', labelKey: 'common.system' },
  { appearance: Appearance.light, icon: 'sun', labelKey: 'common.light' },
  { appearance: Appearance.dark, icon: 'moon-star', labelKey: 'common.dark' },
];

const ThemeBuilder: FC<ThemeBuilderProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const { addUnsubscribe } = useUnmounted();

  const handleClose = () => {
    const { store } = app.value;
    store.dispatch(changeOpenMapAction({ [Open.themeBuilder]: false }));
  };

  /** The close button held the keyboard and leaves with the panel, so the editor takes it back. */
  const handleCloseButton = () => {
    handleClose();
    nextTick(() => {
      ctx.host.dispatchEvent(focusEvent());
    });
  };

  /**
   * Space is the hand tool's key and Enter opens a focused cell, and the panel
   * stops no key, so the button keeps both for its press; Escape still closes.
   */
  const handleCloseKeydown = (event: KeyboardEvent) => {
    if (event.code === 'Space' || event.key === 'Enter') {
      event.stopPropagation();
    }
  };

  const handleToggle = () => {
    const { store } = app.value;
    const {
      editor: { openMap },
    } = store.state;

    const opened = !openMap[Open.themeBuilder];
    store.dispatch(changeOpenMapAction({ [Open.themeBuilder]: opened }));

    if (opened) {
      store.dispatch(
        changeOpenMapAction({
          [Open.tableProperties]: false,
          [Open.localePicker]: false,
          [Open.findReplace]: false,
        })
      );
    }
  };

  const handleChangeAccentColor = (accentColor: AccentColor) => {
    const { emitter } = app.value;
    emitter.emit(setThemeOptionsAction({ accentColor }));
  };

  const handleChangeGrayColor = (grayColor: GrayColor) => {
    const { emitter } = app.value;
    emitter.emit(setThemeOptionsAction({ grayColor }));
  };

  const handleChangeAppearance = (appearance: AppearanceOption) => {
    const { emitter } = app.value;
    emitter.emit(setThemeOptionsAction({ appearance }));
  };

  onMounted(() => {
    const { shortcut$, emitter } = app.value;

    addUnsubscribe(
      shortcut$
        .pipe(filter(({ type }) => type === KeyBindingName.stop))
        .subscribe(handleClose),
      emitter.on({ openThemeBuilder: handleToggle })
    );
  });

  return () => {
    const { store } = app.value;
    const {
      editor: { openMap },
    } = store.state;
    if (!openMap[Open.themeBuilder]) return null;

    const { theme } = props;
    const { t } = i18n.value;
    const { keyBindingMap } = app.value;

    return (
      <div
        class={['theme-builder', styles.root]}
        style={insetPastExplorer(store, i18n.value.dir)}
      >
        <div class={styles.header}>
          <div class={styles.title}>{t('common.theme')}</div>
          <button
            class={['theme-builder-close', styles.close]}
            type="button"
            aria-label={t('common.close')}
            title={toShortcutTitle(
              keyBindingMap,
              t('common.close'),
              KeyBindingName.stop
            )}
            on:click={handleCloseButton}
            on:keydown={handleCloseKeydown}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <div class={styles.subTitle}>{t('themeBuilder.accentColor')}</div>
        <div class={styles.palette}>
          {AccentColorList.map(key => (
            <span
              class={[styles.color, { selected: key === theme.accentColor }]}
              style={{
                'background-color': get(Palette, [key, `${key}9`]),
              }}
              title={key}
              on:click={() => handleChangeAccentColor(key)}
            />
          ))}
        </div>
        <div class={styles.subTitle}>{t('themeBuilder.grayColor')}</div>
        <div class={styles.palette}>
          {GrayColorList.map(key => (
            <span
              class={[styles.color, { selected: key === theme.grayColor }]}
              style={{
                'background-color': get(Palette, [key, `${key}9`]),
              }}
              title={key}
              on:click={() => handleChangeGrayColor(key)}
            />
          ))}
        </div>
        <div class={styles.subTitle}>{t('themeBuilder.appearance')}</div>
        <div class={styles.appearanceButtonGroup}>
          {APPEARANCE_BUTTONS.map(({ appearance, icon, labelKey }) => (
            <div
              class={[
                styles.appearanceButton,
                { selected: theme.appearance === appearance },
              ]}
              on:click={() => handleChangeAppearance(appearance)}
            >
              <Icon name={icon} />
              <span class={styles.vertical} />
              <span>{t(labelKey)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };
};

export default ThemeBuilder;

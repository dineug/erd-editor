import { FC, onMounted } from '@dineug/r-html';
import { get } from 'es-toolkit/compat';
import { filter } from 'rxjs';

import { useAppContext } from '@/components/appContext';
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
import { KeyBindingName } from '@/utils/keyboard-shortcut';

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

    return (
      <div class={['theme-builder', styles.root]}>
        <div class={styles.title}>{t('common.theme')}</div>
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

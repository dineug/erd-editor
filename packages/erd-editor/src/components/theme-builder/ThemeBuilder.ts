import { FC, html, onMounted } from '@dineug/r-html';
import { get } from 'lodash-es';
import { filter } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import {
  AccentColor,
  AccentColorList,
  Appearance,
  GrayColor,
  GrayColorList,
  Palette,
  ThemeOptions,
} from '@/themes/radix-ui-theme';
import { setThemeOptionsAction } from '@/utils/emitter';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import Icon from '../primitives/icon/Icon';
import * as styles from './ThemeBuilder.styles';

export type ThemeBuilderProps = {
  theme: ThemeOptions;
};

const ThemeBuilder: FC<ThemeBuilderProps> = (props, ctx) => {
  const app = useAppContext(ctx);
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
      store.dispatch(changeOpenMapAction({ [Open.tableProperties]: false }));
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

  const handleChangeAppearance = (appearance: Appearance) => {
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

    return html`
      <div class=${['theme-builder', styles.root]}>
        <div class=${styles.title}>Theme</div>
        <div class=${styles.subTitle}>Accent color</div>
        <div class=${styles.palette}>
          ${AccentColorList.map(
            key => html`
              <span
                class=${[styles.color, { selected: key === theme.accentColor }]}
                style=${{
                  'background-color': get(Palette, [key, `${key}9`]),
                }}
                title=${key}
                @click=${() => handleChangeAccentColor(key)}
              ></span>
            `
          )}
        </div>
        <div class=${styles.subTitle}>Gray color</div>
        <div class=${styles.palette}>
          ${GrayColorList.map(
            key => html`
              <span
                class=${[styles.color, { selected: key === theme.grayColor }]}
                style=${{
                  'background-color': get(Palette, [key, `${key}9`]),
                }}
                title=${key}
                @click=${() => handleChangeGrayColor(key)}
              ></span>
            `
          )}
        </div>
        <div class=${styles.subTitle}>Appearance</div>
        <div class=${styles.lightDarkButtonGroup}>
          <div
            class=${[
              styles.lightDarkButton,
              { selected: theme.appearance === Appearance.light },
            ]}
            @click=${() => handleChangeAppearance(Appearance.light)}
          >
            <${Icon} prefix="mdi" name="white-balance-sunny" />
            <span class=${styles.vertical}></span>
            <span>Light</span>
          </div>
          <div
            class=${[
              styles.lightDarkButton,
              ,
              { selected: theme.appearance === Appearance.dark },
            ]}
            @click=${() => handleChangeAppearance(Appearance.dark)}
          >
            <${Icon} prefix="mdi" name="weather-might" />
            <span class=${styles.vertical}></span>
            <span>Dark</span>
          </div>
        </div>
      </div>
    `;
  };
};

export default ThemeBuilder;

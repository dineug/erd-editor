import { FC } from '@dineug/r-html';

import { arrowDown, arrowUp } from '@/components/erd/welcome-screen/welcomeArt';
import {
  hintPlacement,
  HintSide,
} from '@/components/erd/welcome-screen/welcomeLayout';
import { useI18n } from '@/components/localeContext';
import type { PlainMessageKey } from '@/i18n/translate';

import * as styles from './WelcomeHints.styles';

export type WelcomeHintsProps = {
  /** Where the toolbar's Search button stands across the welcome screen, or null. */
  search: number | null;
  /** Where the theme and language buttons stand between them, or null. */
  preferences: number | null;
  width: number;
  enableThemeBuilder?: boolean;
  enableLocalePicker?: boolean;
};

const px = (value: number | undefined) =>
  value === undefined ? null : `${value}px`;

/** What the hint at the theme and language buttons says, by which of the two the toolbar shows. */
export function preferencesHintKey(
  theme: boolean,
  locale: boolean
): PlainMessageKey | null {
  if (theme && locale) return 'welcome.hintThemeAndLanguage';
  if (theme) return 'welcome.hintTheme';
  if (locale) return 'welcome.hintLanguage';
  return null;
}

/**
 * The hand-drawn arrows at the tools an empty diagram starts from: the
 * palette's Search button and the theme and language buttons on the toolbar,
 * each labelled on its own side, and the floating toolbar at the bottom.
 */
const WelcomeHints: FC<WelcomeHintsProps> = (props, ctx) => {
  const i18n = useI18n(ctx);

  const upHint = (
    name: string,
    anchorX: number,
    side: HintSide,
    text: string
  ) => {
    const { dir } = i18n.value;
    const placement = hintPlacement(anchorX, props.width, side, dir);
    const label = (
      <span
        class={styles.label}
        prop:dir={dir}
        style={{ 'text-align': placement.labelFirst ? 'right' : 'left' }}
      >
        {text}
      </span>
    );
    const art = arrowUp(!placement.labelFirst);

    return (
      <div
        class={[
          'welcome-screen-hint',
          `welcome-screen-hint-${name}`,
          styles.up,
        ]}
        prop:dir="ltr"
        style={{ left: px(placement.left), right: px(placement.right) }}
      >
        {placement.labelFirst ? [label, art] : [art, label]}
      </div>
    );
  };

  return () => {
    const { t } = i18n.value;
    const preferencesKey = preferencesHintKey(
      Boolean(props.enableThemeBuilder),
      Boolean(props.enableLocalePicker)
    );

    return (
      <>
        {props.search === null
          ? null
          : upHint('palette', props.search, 'before', t('welcome.hintPalette'))}
        {props.preferences === null || preferencesKey === null
          ? null
          : upHint(
              'preferences',
              props.preferences,
              'after',
              t(preferencesKey)
            )}
        <div
          class={[
            'welcome-screen-hint',
            'welcome-screen-hint-tools',
            styles.down,
          ]}
        >
          <span class={styles.label}>{t('welcome.hintFloatingToolbar')}</span>
          {arrowDown()}
        </div>
      </>
    );
  };
};

export default WelcomeHints;

import { FC } from '@dineug/r-html';

import { useI18n } from '@/components/localeContext';
import Separator from '@/components/primitives/separator/Separator';
import type { PlainMessageKey } from '@/i18n/translate';
import { ValuesType } from '@/internal-types';
import { fontSize6 } from '@/styles/typography.styles';

import * as styles from './SettingsLnb.styles';

export const Lnb = {
  preferences: 'Preferences',
  shortcuts: 'Shortcuts',
} as const;
export type Lnb = ValuesType<typeof Lnb>;
const LnbList: ReadonlyArray<Lnb> = Object.values(Lnb);

/** Each page's name as the key of its message; the page ids stay English. */
export const LnbLabelKey: Readonly<Record<Lnb, PlainMessageKey>> = {
  [Lnb.preferences]: 'settings.preferences',
  [Lnb.shortcuts]: 'common.shortcuts',
};

export type SettingsLnbProps = {
  value: Lnb;
  onChange: (value: Lnb) => void;
};

const SettingsLnb: FC<SettingsLnbProps> = (props, ctx) => {
  const i18n = useI18n(ctx);

  return () => {
    const { t } = i18n.value;

    return (
      <div class={styles.lnb}>
        <div class={fontSize6}>{t('common.tab.settings')}</div>
        <Separator space={12} />
        <div class={['scrollbar', styles.list]}>
          {LnbList.map(lnb => (
            <div
              class={[styles.item, { selected: lnb === props.value }]}
              on:click={() => props.onChange(lnb)}
            >
              {t(LnbLabelKey[lnb])}
            </div>
          ))}
        </div>
      </div>
    );
  };
};

export default SettingsLnb;

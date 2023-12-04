import { FC, html } from '@dineug/r-html';

import Separator from '@/components/primitives/separator/Separator';
import { ValuesType } from '@/internal-types';
import { fontSize6 } from '@/styles/typography.styles';

import * as styles from './SettingsLnb.styles';

export const Lnb = {
  preferences: 'Preferences',
  shortcuts: 'Shortcuts',
} as const;
export type Lnb = ValuesType<typeof Lnb>;
const LnbList: ReadonlyArray<string> = Object.values(Lnb);

export type SettingsLnbProps = {
  value: Lnb;
  onChange: (value: Lnb) => void;
};

const SettingsLnb: FC<SettingsLnbProps> = (props, ctx) => {
  return () => html`
    <div class=${styles.lnb}>
      <div class=${fontSize6}>Settings</div>
      <${Separator} space=${12} />
      <div class=${['scrollbar', styles.list]}>
        ${LnbList.map(
          lnb =>
            html`
              <div
                class=${[styles.item, { selected: lnb === props.value }]}
                @click=${() => props.onChange(lnb as Lnb)}
              >
                ${lnb}
              </div>
            `
        )}
      </div>
    </div>
  `;
};

export default SettingsLnb;

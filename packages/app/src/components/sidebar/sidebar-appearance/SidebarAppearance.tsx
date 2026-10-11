import { SegmentedControl } from '@radix-ui/themes';
import { LucideIcon, Monitor, Moon, Sun } from 'lucide-react';

import { useI18n } from '@/atoms/modules/locale';
import {
  useAppearancePreference,
  useSetAppearance,
} from '@/atoms/modules/theme';
import type { PlainMessageKey } from '@/i18n/translate';
import { AppearancePreference } from '@/utils/theme';

import * as styles from './SidebarAppearance.styles';

type AppearanceOption = {
  value: AppearancePreference;
  labelKey: PlainMessageKey;
  Icon: LucideIcon;
};

const OPTIONS: AppearanceOption[] = [
  { value: 'system', labelKey: 'common.system', Icon: Monitor },
  { value: 'light', labelKey: 'common.light', Icon: Sun },
  { value: 'dark', labelKey: 'common.dark', Icon: Moon },
];

interface SidebarAppearanceProps {}

const SidebarAppearance: React.FC<SidebarAppearanceProps> = () => {
  const appearance = useAppearancePreference();
  const setAppearance = useSetAppearance();
  const { t } = useI18n();

  return (
    <SegmentedControl.Root
      css={styles.root}
      size="1"
      value={appearance}
      aria-label={t('common.theme')}
      onValueChange={value => setAppearance(value as AppearancePreference)}
    >
      {OPTIONS.map(({ value, labelKey, Icon }) => (
        <SegmentedControl.Item
          key={value}
          css={styles.item}
          value={value}
          aria-label={t(labelKey)}
          title={t(labelKey)}
        >
          <Icon size={14} aria-hidden />
        </SegmentedControl.Item>
      ))}
    </SegmentedControl.Root>
  );
};

export default SidebarAppearance;

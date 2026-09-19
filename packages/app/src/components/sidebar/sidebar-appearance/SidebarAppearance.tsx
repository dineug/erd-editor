import { SegmentedControl } from '@radix-ui/themes';
import { LucideIcon, Monitor, Moon, Sun } from 'lucide-react';

import {
  useAppearancePreference,
  useSetAppearance,
} from '@/atoms/modules/theme';
import { AppearancePreference } from '@/utils/theme';

import * as styles from './SidebarAppearance.styles';

type AppearanceOption = {
  value: AppearancePreference;
  label: string;
  Icon: LucideIcon;
};

const OPTIONS: AppearanceOption[] = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

interface SidebarAppearanceProps {}

const SidebarAppearance: React.FC<SidebarAppearanceProps> = () => {
  const appearance = useAppearancePreference();
  const setAppearance = useSetAppearance();

  return (
    <SegmentedControl.Root
      css={styles.root}
      size="1"
      value={appearance}
      aria-label="Theme"
      onValueChange={value => setAppearance(value as AppearancePreference)}
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <SegmentedControl.Item
          key={value}
          css={styles.item}
          value={value}
          aria-label={label}
          title={label}
        >
          <Icon size={14} aria-hidden />
        </SegmentedControl.Item>
      ))}
    </SegmentedControl.Root>
  );
};

export default SidebarAppearance;

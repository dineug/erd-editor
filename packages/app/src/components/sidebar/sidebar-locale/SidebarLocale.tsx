import { DropdownMenu, IconButton } from '@radix-ui/themes';
import { Languages } from 'lucide-react';

import {
  useI18n,
  useLocalePreference,
  useSetLocalePreference,
  useSystemLocale,
} from '@/atoms/modules/locale';
import { isLocaleCode, localeInfoOf, LOCALES } from '@/i18n/locales';
import type { LocalePreference } from '@/utils/locale';

import * as styles from './SidebarLocale.styles';

const SYSTEM: LocalePreference = 'system';

interface SidebarLocaleProps {}

/**
 * The display language of the app and its editors, the list the editor's own
 * picker shows: System, naming the language it stands for, then each language
 * in its own name. A pick is stored as the editor's is, so both follow it.
 */
const SidebarLocale: React.FC<SidebarLocaleProps> = () => {
  const { t } = useI18n();
  const preference = useLocalePreference();
  const setPreference = useSetLocalePreference();
  const system = localeInfoOf(useSystemLocale());
  const value = isLocaleCode(preference) ? preference : SYSTEM;
  const label = t('common.displayLanguage');

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <IconButton
          css={styles.trigger}
          size="1"
          variant="ghost"
          color="gray"
          aria-label={label}
          title={label}
        >
          <Languages size={14} aria-hidden />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content side="top" align="end">
        <DropdownMenu.Label>{label}</DropdownMenu.Label>
        <DropdownMenu.RadioGroup
          value={value}
          onValueChange={next => setPreference(next as LocalePreference)}
        >
          <DropdownMenu.RadioItem value={SYSTEM}>
            {t('common.system')}
            <span css={styles.hint} lang={system.code} dir="auto">
              {system.label}
            </span>
          </DropdownMenu.RadioItem>
          <DropdownMenu.Separator />
          {LOCALES.map(({ code, label }) => (
            <DropdownMenu.RadioItem key={code} value={code} lang={code}>
              {label}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};

export default SidebarLocale;

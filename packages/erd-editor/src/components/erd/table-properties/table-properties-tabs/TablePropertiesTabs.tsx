import { FC } from '@dineug/r-html';

import { useI18n } from '@/components/localeContext';
import type { PlainMessageKey } from '@/i18n/translate';
import { ValuesType } from '@/internal-types';

import * as styles from './TablePropertiesTabs.styles';

export const Tab = {
  Indexes: 'Indexes',
  SchemaSQL: 'Schema SQL',
  GeneratorCode: 'Code Generator',
} as const;
export type Tab = ValuesType<typeof Tab>;
const tabs: ReadonlyArray<Tab> = Object.values(Tab);

/** What each tab is called in the reader's language; its id stays the English name. */
export const TabLabelKey: Record<Tab, PlainMessageKey> = {
  [Tab.Indexes]: 'tableProperties.indexes',
  [Tab.SchemaSQL]: 'common.tab.schemaSql',
  [Tab.GeneratorCode]: 'common.tab.codeGenerator',
};

export type TablePropertiesTabsProps = {
  value: Tab;
  onChange: (value: Tab) => void;
};

const TablePropertiesTabs: FC<TablePropertiesTabsProps> = (props, ctx) => {
  const i18n = useI18n(ctx);

  return () => (
    <div class={styles.tabs}>
      {tabs.map(tab => (
        <div
          class={[styles.tab, { selected: tab === props.value }]}
          on:click={() => props.onChange(tab)}
        >
          {i18n.value.t(TabLabelKey[tab])}
        </div>
      ))}
    </div>
  );
};

export default TablePropertiesTabs;

import { FC } from '@dineug/r-html';

import { ValuesType } from '@/internal-types';

import * as styles from './TablePropertiesTabs.styles';

export const Tab = {
  Indexes: 'Indexes',
  SchemaSQL: 'Schema SQL',
  GeneratorCode: 'Code Generator',
} as const;
export type Tab = ValuesType<typeof Tab>;
const tabs: ReadonlyArray<string> = Object.values(Tab);

export type TablePropertiesTabsProps = {
  value: Tab;
  onChange: (value: Tab) => void;
};

const TablePropertiesTabs: FC<TablePropertiesTabsProps> = (props, ctx) => {
  return () => (
    <div class={styles.tabs}>
      {tabs.map(tab => (
        <div
          class={[styles.tab, { selected: tab === props.value }]}
          on:click={() => props.onChange(tab as Tab)}
        >
          {tab}
        </div>
      ))}
    </div>
  );
};

export default TablePropertiesTabs;

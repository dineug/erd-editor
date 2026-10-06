import { FC } from '@dineug/r-html';

import { useI18n } from '@/components/localeContext';
import Icon from '@/components/primitives/icon/Icon';
import type { PlainMessageKey } from '@/i18n/translate';
import type { ColumnKey } from '@/utils/tableKeys';

import * as styles from './IndexesKey.styles';

export type IndexesKeyProps = {
  columnKey: ColumnKey;
  selected: boolean;
  onSelect: (columnKey: ColumnKey) => void;
};

/** A key's tag, written as the diagram writes it in every language, and the key of the name it shows on hover. */
export const KIND_LABEL: Record<
  ColumnKey['kind'],
  { text: string; titleKey: PlainMessageKey }
> = {
  primaryKey: { text: 'PK', titleKey: 'common.primaryKey' },
  unique: { text: 'UQ', titleKey: 'tableProperties.uniqueColumn' },
};

/**
 * A key the table's columns declare, listed beside the indexes so every key
 * shows in one place. A lock stands where an index has its remove button:
 * selecting it only shows its columns, and the columns are where it changes.
 */
const IndexesKey: FC<IndexesKeyProps> = (props, ctx) => {
  const i18n = useI18n(ctx);

  const handleSelect = () => {
    props.onSelect(props.columnKey);
  };

  return () => {
    const { columnKey } = props;
    const { t } = i18n.value;
    const label = KIND_LABEL[columnKey.kind];
    const title = t(label.titleKey);

    return (
      <div
        class={[styles.row, { selected: props.selected }]}
        title={title}
        on:click={handleSelect}
      >
        <div class="column-col">
          <span class={styles.tag} title={title}>
            {label.text}
          </span>
        </div>
        <div class={styles.name}>{columnKey.name}</div>
        <Icon
          class={styles.lock}
          size={12}
          name="lock"
          title={t('tableProperties.readOnlyKey')}
        />
      </div>
    );
  };
};

export default IndexesKey;

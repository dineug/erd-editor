import { FC } from '@dineug/r-html';

import Icon from '@/components/primitives/icon/Icon';
import ColumnOption from '@/components/table-view/column/column-option/ColumnOption';
import { COLUMN_UNIQUE_WIDTH } from '@/constants/layout';
import type { ColumnKey } from '@/utils/tableKeys';

import * as styles from './IndexesKey.styles';

export type IndexesKeyProps = {
  columnKey: ColumnKey;
  selected: boolean;
  onSelect: (columnKey: ColumnKey) => void;
};

const KIND_LABEL: Record<ColumnKey['kind'], { text: string; title: string }> = {
  primaryKey: { text: 'PK', title: 'Primary Key' },
  unique: { text: 'UQ', title: 'Unique Column' },
};

/**
 * A key the table's columns declare, listed beside the indexes so every key
 * shows in one place. A lock stands where an index has its remove button:
 * selecting it only shows its columns, and the columns are where it changes.
 */
const IndexesKey: FC<IndexesKeyProps> = props => {
  const handleSelect = () => {
    props.onSelect(props.columnKey);
  };

  return () => {
    const { columnKey } = props;
    const label = KIND_LABEL[columnKey.kind];

    return (
      <div
        class={[styles.row, { selected: props.selected }]}
        title={label.title}
        on:click={handleSelect}
      >
        <div class="column-col">
          <ColumnOption
            checked={true}
            width={COLUMN_UNIQUE_WIDTH}
            text={label.text}
            title={label.title}
          />
        </div>
        <div class={['column-col', styles.name]}>{columnKey.name}</div>
        <Icon class={styles.lock} size={12} name="lock" title="Read Only" />
      </div>
    );
  };
};

export default IndexesKey;

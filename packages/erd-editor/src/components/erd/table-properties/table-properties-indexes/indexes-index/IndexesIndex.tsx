import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Icon from '@/components/primitives/icon/Icon';
import TextInput from '@/components/primitives/text-input/TextInput';
import ColumnOption from '@/components/table-view/column/column-option/ColumnOption';
import { COLUMN_UNIQUE_WIDTH } from '@/constants/layout';
import {
  changeIndexNameAction,
  removeIndexAction,
} from '@/engine/modules/index/atom.actions';
import { changeIndexUniqueAction$ } from '@/engine/modules/index/generator.actions';
import { attachChangeOnlyTag$ } from '@/engine/tag';
import { Index } from '@/internal-types';

import * as styles from './IndexesIndex.styles';

export type IndexesIndexProps = {
  index: Index;
  selected: boolean;
  onSelect: (index: Index | null) => void;
};

const IndexesIndex: FC<IndexesIndexProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const handleSelect = () => {
    props.onSelect(props.index);
  };

  const handleRemoveIndex = (event: MouseEvent) => {
    event.stopPropagation();
    props.onSelect(null);

    const { store } = app.value;
    store.dispatch(
      attachChangeOnlyTag$(removeIndexAction({ id: props.index.id }))
    );
  };

  const handleChangeUniqueIndex = () => {
    const { store } = app.value;
    store.dispatch(
      attachChangeOnlyTag$(changeIndexUniqueAction$(props.index.id))
    );
  };

  const handleChangeIndexName = (event: InputEvent) => {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;

    const { store } = app.value;
    store.dispatch(
      attachChangeOnlyTag$(
        changeIndexNameAction({
          id: props.index.id,
          tableId: props.index.tableId,
          value: input.value,
        })
      )
    );
  };

  return () => {
    const { index } = props;

    return (
      <div
        class={[styles.row, { selected: props.selected }]}
        on:click={handleSelect}
      >
        <div class="column-col" on:click={handleChangeUniqueIndex}>
          <ColumnOption
            class={styles.unique}
            checked={index.unique}
            width={COLUMN_UNIQUE_WIDTH}
            text="UQ"
            title="Unique"
          />
        </div>
        <div class={['column-col', styles.input]}>
          <TextInput
            class={styles.input}
            placeholder="name"
            value={index.name}
            onInput={handleChangeIndexName}
          />
        </div>
        <Icon
          class={styles.iconButton}
          size={12}
          name="x"
          title="Remove"
          onClick={handleRemoveIndex}
        />
      </div>
    );
  };
};

export default IndexesIndex;

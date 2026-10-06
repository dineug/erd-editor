import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useI18n } from '@/components/localeContext';
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
  /**
   * The alternate key this index is, 1 for AK1, which the diagram can mark its
   * columns with; 0 while it is no unique index over two columns or more.
   */
  alternateKey?: number;
  selected: boolean;
  /** The editor's readonly mode: the row only selects, with no remove button and a name it cannot type in. */
  readonly?: boolean;
  onSelect: (index: Index | null) => void;
};

const IndexesIndex: FC<IndexesIndexProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);

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
    if (props.readonly) return;

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
    const { index, readonly } = props;
    const { t } = i18n.value;

    return (
      <div
        class={[styles.row, { selected: props.selected }]}
        on:click={handleSelect}
      >
        <div class="column-col" on:click={handleChangeUniqueIndex}>
          <ColumnOption
            class={readonly ? null : styles.unique}
            checked={index.unique}
            width={COLUMN_UNIQUE_WIDTH}
            text="UQ"
            title={t('common.column.unique')}
          />
        </div>
        <div class={['column-col', styles.nameCell]}>
          <TextInput
            class={styles.input}
            placeholder={t('tableProperties.indexName')}
            readonly={readonly}
            value={index.name}
            onInput={handleChangeIndexName}
          />
        </div>
        {props.alternateKey ? (
          <div
            class={styles.alternateKey}
            title={t('tableProperties.alternateKeyN', {
              n: props.alternateKey,
            })}
          >
            {`AK${props.alternateKey}`}
          </div>
        ) : null}
        {readonly ? null : (
          <Icon
            class={styles.iconButton}
            size={12}
            name="x"
            title={t('tableProperties.remove')}
            onClick={handleRemoveIndex}
          />
        )}
      </div>
    );
  };
};

export default IndexesIndex;

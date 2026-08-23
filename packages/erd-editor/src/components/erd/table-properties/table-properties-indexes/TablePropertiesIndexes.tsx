import { query } from '@dineug/erd-editor-schema';
import { FC, observable, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import IndexesIndex from '@/components/erd/table-properties//table-properties-indexes/indexes-index/IndexesIndex';
import IndexesCheckboxColumn from '@/components/erd/table-properties/table-properties-indexes/indexes-checkbox-column/IndexesCheckboxColumn';
import IndexesColumn from '@/components/erd/table-properties/table-properties-indexes/indexes-column/IndexesColumn';
import Icon from '@/components/primitives/icon/Icon';
import { addIndexAction$ } from '@/engine/modules/index/generator.actions';
import { attachChangeOnlyTag$ } from '@/engine/tag';
import { Index } from '@/internal-types';

import * as styles from './TablePropertiesIndexes.styles';

export type TablePropertiesIndexesProps = {
  tableId: string;
};

const TablePropertiesIndexes: FC<TablePropertiesIndexesProps> = (
  props,
  ctx
) => {
  const app = useAppContext(ctx);

  const state = observable({
    indexId: null as string | null,
  });

  const handleSelectIndex = (index: Index | null) => {
    state.indexId = index?.id ?? null;
  };

  const handleAddIndex = () => {
    const { store } = app.value;
    store.dispatch(attachChangeOnlyTag$(addIndexAction$(props.tableId)));
  };

  return () => {
    const { tableId } = props;
    const { store } = app.value;
    const {
      doc: { indexIds },
      collections,
    } = store.state;

    const indexes = query(collections)
      .collection('indexEntities')
      .selectByIds(indexIds)
      .filter(index => index.tableId === tableId);

    const { indexId } = state;
    const selectedIndex = indexes.find(index => index.id === indexId) ?? null;

    return (
      <>
        <div class={styles.leftArea}>
          {repeat(
            indexes,
            index => index.id,
            index => (
              <IndexesIndex
                index={index}
                selected={index.id === selectedIndex?.id}
                onSelect={handleSelectIndex}
              />
            )
          )}
          <div
            class={styles.addIndexButtonArea}
            title="Add Index"
            on:click={handleAddIndex}
          >
            <Icon size={12} name="plus" />
          </div>
        </div>
        <div class={styles.rightArea}>
          <IndexesCheckboxColumn tableId={tableId} index={selectedIndex} />
          {selectedIndex ? <IndexesColumn index={selectedIndex} /> : null}
        </div>
      </>
    );
  };
};

export default TablePropertiesIndexes;

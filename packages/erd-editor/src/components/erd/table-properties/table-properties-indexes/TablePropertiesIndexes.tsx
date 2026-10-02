import { query } from '@dineug/erd-editor-schema';
import { FC, observable, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import IndexesCheckboxColumn from '@/components/erd/table-properties/table-properties-indexes/indexes-checkbox-column/IndexesCheckboxColumn';
import IndexesColumn from '@/components/erd/table-properties/table-properties-indexes/indexes-column/IndexesColumn';
import IndexesIndex from '@/components/erd/table-properties/table-properties-indexes/indexes-index/IndexesIndex';
import IndexesKey from '@/components/erd/table-properties/table-properties-indexes/indexes-key/IndexesKey';
import Icon from '@/components/primitives/icon/Icon';
import Separator from '@/components/primitives/separator/Separator';
import { TABLE_PADDING } from '@/constants/layout';
import { addIndexAction$ } from '@/engine/modules/index/generator.actions';
import { attachChangeOnlyTag$ } from '@/engine/tag';
import { Index } from '@/internal-types';
import { ColumnKey, getAlternateKeys, getColumnKeys } from '@/utils/tableKeys';

import * as styles from './TablePropertiesIndexes.styles';

export type TablePropertiesIndexesProps = {
  tableId: string;
};

type ColumnsStatus = {
  text: string;
  /** A key is picked, which the columns set and this tab only shows. */
  readonly: boolean;
};

const KEY_FLAG_TEXT: Record<ColumnKey['kind'], string> = {
  primaryKey: 'the PK flag on its columns',
  unique: 'the UQ flag on its column',
};

/**
 * What the Columns heading says about the list under it: how many columns
 * the picked index has, who sets a picked key, or what to pick first.
 */
function toColumnsStatus(
  selectedIndex: Index | null,
  selectedKey: ColumnKey | null,
  checkedCount: number,
  columnCount: number,
  hasKeys: boolean,
  hasIndexes: boolean
): ColumnsStatus {
  if (selectedIndex) {
    return {
      text: `${checkedCount} of ${columnCount} selected`,
      readonly: false,
    };
  }
  if (selectedKey) {
    return {
      text: `Read only: set by ${KEY_FLAG_TEXT[selectedKey.kind]}`,
      readonly: true,
    };
  }

  const text = hasKeys
    ? 'Select a key or an index'
    : hasIndexes
      ? 'Select an index to edit its columns'
      : 'Add an index to choose its columns';

  return { text, readonly: false };
}

const TablePropertiesIndexes: FC<TablePropertiesIndexesProps> = (
  props,
  ctx
) => {
  const app = useAppContext(ctx);

  // An index id, or the id of a key the columns declare: one selection
  // across both kinds of row.
  const state = observable({
    indexId: null as string | null,
  });

  const handleSelectIndex = (index: Index | null) => {
    state.indexId = index?.id ?? null;
  };

  const handleSelectKey = (columnKey: ColumnKey) => {
    state.indexId = columnKey.id;
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

    const table = query(collections)
      .collection('tableEntities')
      .selectById(tableId);
    const columnIds = table?.columnIds ?? [];
    const columnCount = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(columnIds).length;
    const indexes = query(collections)
      .collection('indexEntities')
      .selectByIds(indexIds)
      .filter(index => index.tableId === tableId);
    const columnKeys = table ? getColumnKeys(store.state, table) : [];
    const alternateKeyIds = table
      ? getAlternateKeys(store.state, table).map(key => key.indexId)
      : [];

    const { indexId } = state;
    const selectedIndex = indexes.find(index => index.id === indexId) ?? null;
    const selectedKey = columnKeys.find(key => key.id === indexId) ?? null;
    const checkedColumnIds = new Set(
      query(collections)
        .collection('indexColumnEntities')
        .selectByIds(selectedIndex?.indexColumnIds ?? [])
        .map(indexColumn => indexColumn.columnId)
    );
    const status = toColumnsStatus(
      selectedIndex,
      selectedKey,
      columnIds.filter(id => checkedColumnIds.has(id)).length,
      columnCount,
      columnKeys.length > 0,
      indexes.length > 0
    );
    const orderCount = selectedIndex?.indexColumnIds.length ?? 0;

    return (
      <>
        <div class={styles.leftArea}>
          {columnKeys.length ? (
            <div class={styles.sectionLabel}>
              <span>Keys</span>
            </div>
          ) : null}
          {repeat(
            columnKeys,
            columnKey => columnKey.id,
            columnKey => (
              <IndexesKey
                columnKey={columnKey}
                selected={columnKey.id === selectedKey?.id}
                onSelect={handleSelectKey}
              />
            )
          )}
          {columnKeys.length ? (
            <Separator space={4} padding={TABLE_PADDING} />
          ) : null}
          <div class={styles.sectionLabel}>
            <span>Indexes</span>
          </div>
          {repeat(
            indexes,
            index => index.id,
            index => (
              <IndexesIndex
                index={index}
                alternateKey={alternateKeyIds.indexOf(index.id) + 1}
                selected={index.id === selectedIndex?.id}
                onSelect={handleSelectIndex}
              />
            )
          )}
          {indexes.length ? null : (
            <div class={styles.hint}>No indexes yet</div>
          )}
          <div
            class={styles.addIndexButtonArea}
            title="Add Index"
            on:click={handleAddIndex}
          >
            <Icon class={styles.addIcon} size={12} name="plus" />
            <span>Add Index</span>
          </div>
        </div>
        <div class={styles.rightArea}>
          <div class={styles.sectionLabel}>
            <span>Columns</span>
            <span class={styles.sectionStatus}>
              {status.readonly ? <Icon size={12} name="lock" /> : null}
              <span>{status.text}</span>
            </span>
          </div>
          {columnCount ? (
            <div class={['scrollbar', styles.columns]}>
              <IndexesCheckboxColumn
                tableId={tableId}
                index={selectedIndex}
                keyColumnIds={selectedKey?.columnIds ?? null}
              />
            </div>
          ) : (
            <div class={styles.hint}>This table has no columns</div>
          )}
          {selectedIndex ? (
            <div class={styles.order}>
              <div class={styles.sectionLabel}>
                <span>Index order</span>
                {orderCount > 1 ? (
                  <span class={styles.sectionStatus}>
                    <span>Drag to reorder</span>
                  </span>
                ) : null}
              </div>
              {orderCount ? (
                <IndexesColumn
                  index={selectedIndex}
                  alternateKey={alternateKeyIds.indexOf(selectedIndex.id) + 1}
                />
              ) : (
                <div class={styles.hint}>Check columns above to add them</div>
              )}
            </div>
          ) : null}
        </div>
      </>
    );
  };
};

export default TablePropertiesIndexes;

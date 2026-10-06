import { query } from '@dineug/erd-editor-schema';
import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import * as buttonStyles from '@/components/primitives/button/Button.styles';
import { Column, Table } from '@/internal-types';
import {
  type CandidateKey,
  type ColumnPick,
  getTypeNote,
  getUsedColumnIds,
  type MapColumnsView,
  type MappingRowView,
} from '@/utils/map-columns';

import * as styles from './MapColumnsDialog.styles';
import { mapColumnsText, nameOf, relationshipTypeText } from './mapColumnsText';

export type MapColumnsBodyProps = {
  mode: 'create' | 'edit';
  view: MapColumnsView;
  /** Whether the editor is too narrow for the two columns side by side. */
  stacked: boolean;
  isDarkMode: boolean;
  onKeyChange: (keyId: string) => void;
  onPick: (parentColumnId: string, pick: ColumnPick | null) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

const EMPTY_VALUE = '';
const NEW_VALUE = 'new';
const COLUMN_PREFIX = 'column:';

/** A pick as an option's value, which a column id never collides with. */
export const toOptionValue = (pick: ColumnPick | null) =>
  !pick
    ? EMPTY_VALUE
    : pick.kind === 'new'
      ? NEW_VALUE
      : COLUMN_PREFIX + pick.columnId;

export const toPick = (value: string): ColumnPick | null =>
  value === NEW_VALUE
    ? { kind: 'new' }
    : value.startsWith(COLUMN_PREFIX)
      ? { kind: 'existing', columnId: value.slice(COLUMN_PREFIX.length) }
      : null;

const isBlank = (name: string) => !name.trim();

type Message = { text: string; error: boolean };

/**
 * The body of Map Columns: the parent's key, a row per key column with a list
 * of the child's columns, one line saying what stands in the way, and Cancel
 * beside the button that writes the mapping.
 */
const MapColumnsBody: FC<MapColumnsBodyProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const columnsOf = () =>
    query(app.value.store.state.collections).collection('tableColumnEntities');

  const keyLabel = (key: CandidateKey) => {
    if (key.kind === 'primaryKey') return mapColumnsText('common.primaryKey');
    if (key.kind === 'current') {
      return mapColumnsText('mapColumns.currentColumns');
    }

    const column = columnsOf().selectById(key.columnIds[0]);
    return mapColumnsText('mapColumns.unique', {
      column: column ? nameOf(column) : '',
    });
  };

  const mappingMessage = (): Message | null => {
    const { issues, notice, keyId, parentTable } = props.view;
    const table = nameOf(parentTable);

    if (issues.set.includes('selfOnly')) {
      return { text: mapColumnsText('mapColumns.selfOnly'), error: true };
    }
    if (issues.set.includes('duplicate')) {
      return { text: mapColumnsText('mapColumns.duplicate'), error: true };
    }
    if (keyId === null) {
      return {
        text: mapColumnsText('mapColumns.noKey', { table }),
        error: true,
      };
    }

    switch (notice) {
      case 'notAKey':
        return {
          text: mapColumnsText('mapColumns.notAKey', { table }),
          error: false,
        };
      case 'noKey':
        return {
          text: mapColumnsText('mapColumns.noKey', { table }),
          error: false,
        };
      case 'fixMapping':
        return { text: mapColumnsText('mapColumns.fixMapping'), error: false };
      case 'addKeyToFix':
        return {
          text: mapColumnsText('mapColumns.addKeyToFix', { table }),
          error: false,
        };
      default:
        return null;
    }
  };

  const typeNote = (row: MappingRowView): string | null => {
    if (
      row.invalid ||
      row.removedParent ||
      row.removedChild ||
      row.parentColumnId === null ||
      row.pick?.kind !== 'existing'
    ) {
      return null;
    }

    const columns = columnsOf();
    const parent = columns.selectById(row.parentColumnId);
    const child = columns.selectById(row.pick.columnId);
    if (!parent || !child) return null;

    const note = getTypeNote(app.value.store.state, parent, child);
    if (!note) return null;

    return note.kind === 'becomes'
      ? mapColumnsText('mapColumns.becomesType', {
          column: nameOf(child),
          dataType: note.dataType,
        })
      : mapColumnsText('mapColumns.typesDiffer', {
          parentType: note.parentType,
          childType: note.childType,
        });
  };

  const parentCell = (row: MappingRowView) => {
    if (row.invalid) {
      return (
        <div class={styles.parent}>
          <span class={styles.dim}>{mapColumnsText('mapColumns.invalid')}</span>
        </div>
      );
    }

    const column =
      row.parentColumnId === null
        ? undefined
        : columnsOf().selectById(row.parentColumnId);
    if (row.removedParent || !column) {
      return (
        <div class={styles.parent}>
          <span class={styles.dim}>{mapColumnsText('mapColumns.removed')}</span>
        </div>
      );
    }

    return (
      <div class={styles.parent}>
        <span class={isBlank(column.name) ? styles.dim : null}>
          {nameOf(column)}
        </span>
        <span class={styles.dataType}>{column.dataType}</span>
      </div>
    );
  };

  const childOption = (column: Column, selected: string, used: Set<string>) => {
    const value = COLUMN_PREFIX + column.id;
    const inUse = used.has(column.id);
    const text = mapColumnsText(
      inUse ? 'mapColumns.columnOptionInUse' : 'mapColumns.columnOption',
      { name: nameOf(column), dataType: column.dataType }
    );

    return (
      <option
        prop:value={value}
        bool:disabled={inUse}
        prop:selected={value === selected}
      >
        {text}
      </option>
    );
  };

  const childSelect = (
    row: MappingRowView,
    index: number,
    childTable: Table,
    autofocus: boolean
  ) => {
    const { rows } = props.view;
    const selected = toOptionValue(row.pick);
    const used = getUsedColumnIds(rows, index);
    const children = columnsOf().selectByIds(childTable.columnIds);
    const parentColumnId = row.parentColumnId;
    const disabled = Boolean(row.invalid) || parentColumnId === null;

    const handleChange = (event: Event) => {
      if (parentColumnId === null) return;
      const { value } = event.target as HTMLSelectElement;
      props.onPick(parentColumnId, toPick(value));
    };

    return (
      <select
        class={styles.select}
        aria-label={mapColumnsText('mapColumns.foreignKeyColumn')}
        data-parent-column-id={parentColumnId ?? ''}
        bool:disabled={disabled}
        bool:data-autofocus={autofocus}
        on:change={handleChange}
      >
        <option
          prop:value={EMPTY_VALUE}
          prop:selected={selected === EMPTY_VALUE}
        >
          {mapColumnsText('mapColumns.pickColumn')}
        </option>
        {row.newColumnName ? (
          <option prop:value={NEW_VALUE} prop:selected={selected === NEW_VALUE}>
            {mapColumnsText('mapColumns.newColumn', {
              name: row.newColumnName,
            })}
          </option>
        ) : null}
        {children.map(column => childOption(column, selected, used))}
        {row.removedChild ? (
          <option
            prop:value={selected}
            bool:disabled={true}
            prop:selected={true}
          >
            {mapColumnsText('mapColumns.removed')}
          </option>
        ) : null}
      </select>
    );
  };

  return () => {
    const { view, mode, stacked } = props;
    const {
      parentTable,
      childTable,
      relationshipType,
      keys,
      keyId,
      showReferences,
      rows,
      changedRemotely,
      canConfirm,
    } = view;
    const message = mappingMessage();
    const emptyIndex = rows.findIndex(
      row => !row.invalid && row.parentColumnId !== null && !row.pick
    );
    const confirmText = mapColumnsText(
      mode === 'create' ? 'mapColumns.map' : 'mapColumns.save'
    );

    return (
      <div
        class={['map-columns', styles.body]}
        style={{ 'color-scheme': props.isDarkMode ? 'dark' : 'light' }}
      >
        <h2 class={styles.title}>{mapColumnsText('mapColumns.title')}</h2>
        <div class={['map-columns-subtitle', styles.subtitle]}>
          {mapColumnsText('mapColumns.subtitle', {
            parent: nameOf(parentTable),
            child: nameOf(childTable),
            relationshipType: relationshipTypeText(relationshipType),
          })}
        </div>
        {showReferences ? (
          <label class={['map-columns-references', styles.references]}>
            <span>{mapColumnsText('mapColumns.references')}</span>
            <select
              class={styles.select}
              aria-label={mapColumnsText('mapColumns.references')}
              on:change={(event: Event) =>
                props.onKeyChange((event.target as HTMLSelectElement).value)
              }
            >
              {keys.map(key => (
                <option prop:value={key.id} prop:selected={key.id === keyId}>
                  {keyLabel(key)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {rows.length ? (
          <div class={['map-columns-rows', styles.grid, { stacked }]}>
            {stacked ? null : (
              <>
                <div class={styles.heading}>
                  {mapColumnsText('mapColumns.referencedColumn')}
                </div>
                <div class={styles.heading}>
                  {mapColumnsText('mapColumns.foreignKeyColumn')}
                </div>
              </>
            )}
            {rows.map((row, index) => {
              const note = typeNote(row);
              return (
                <>
                  {parentCell(row)}
                  {childSelect(row, index, childTable, index === emptyIndex)}
                  {note ? (
                    <div class={['map-columns-note', styles.note]}>{note}</div>
                  ) : null}
                </>
              );
            })}
          </div>
        ) : null}
        {message ? (
          <div
            class={[
              'map-columns-message',
              styles.message,
              { error: message.error },
            ]}
            role={message.error ? 'alert' : 'status'}
          >
            {message.text}
          </div>
        ) : null}
        {changedRemotely ? (
          <div class={['map-columns-changed', styles.message]} role="status">
            {mapColumnsText('mapColumns.changedRemotely')}
          </div>
        ) : null}
        <div class={styles.actions}>
          <button
            class={[
              'map-columns-cancel',
              buttonStyles.button,
              buttonStyles.soft,
              buttonStyles.size2,
            ]}
            type="button"
            bool:data-autofocus={emptyIndex === -1 && !canConfirm}
            on:click={props.onCancel}
          >
            {mapColumnsText('common.cancel')}
          </button>
          <button
            class={[
              'map-columns-confirm',
              buttonStyles.button,
              buttonStyles.solid,
              buttonStyles.size2,
            ]}
            type="button"
            bool:disabled={!canConfirm}
            bool:data-autofocus={emptyIndex === -1 && canConfirm}
            on:click={props.onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    );
  };
};

export default MapColumnsBody;

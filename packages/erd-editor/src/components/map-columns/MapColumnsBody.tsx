import { query } from '@dineug/erd-editor-schema';
import { FC } from '@dineug/r-html';
import { uuid25 } from '@dineug/uuid';

import { useAppContext } from '@/components/appContext';
import { relationshipTypeName } from '@/components/erd/erd-context-menu/menus/relationshipMenus';
import { useI18n } from '@/components/localeContext';
import * as buttonStyles from '@/components/primitives/button/Button.styles';
import Icon from '@/components/primitives/icon/Icon';
import Select from '@/components/primitives/select/Select';
import { toNameLabel } from '@/engine/modules/editor/utils/nameView';
import { Column, Table } from '@/internal-types';
import { KeyBindingName, toShortcutTitle } from '@/utils/keyboard-shortcut';
import {
  type CandidateKey,
  type ColumnPick,
  getTypeNote,
  getUsedColumnIds,
  type MapColumnsView,
  type MappingRowView,
} from '@/utils/map-columns';

import * as styles from './MapColumnsDialog.styles';
import { nameOf } from './nameOf';

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
export function toOptionValue(pick: ColumnPick | null): string {
  if (!pick) return EMPTY_VALUE;
  if (pick.kind === 'new') return NEW_VALUE;
  return COLUMN_PREFIX + pick.columnId;
}

export function toPick(value: string): ColumnPick | null {
  if (value === NEW_VALUE) return { kind: 'new' };
  if (!value.startsWith(COLUMN_PREFIX)) return null;
  return { kind: 'existing', columnId: value.slice(COLUMN_PREFIX.length) };
}

const isBlank = (name: string) => !name.trim();

type Message = { text: string; error: boolean };

type TypeNoteView = { text: string; changes: boolean };

/**
 * The body of Map Columns: the parent's key, a row per key column with a list
 * of the child's columns, one line saying what stands in the way, and Cancel
 * beside the button that writes the mapping.
 */
const MapColumnsBody: FC<MapColumnsBodyProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  // Several editors can share a page, and a list's name points at these ids.
  const labelId = `map-columns-${uuid25()}`;
  const parentNameId = (index: number) => `${labelId}-${index}`;

  const columnsOf = () =>
    query(app.value.store.state.collections).collection('tableColumnEntities');

  /** A name in the name view the store shows, unnamed where it shows none. */
  const named = (entity: { name: string; logicalName: string } | undefined) =>
    nameOf(entity, i18n.value, app.value.store.state.settings);

  const keyLabel = (key: CandidateKey) => {
    const { t } = i18n.value;
    if (key.kind === 'primaryKey') return t('common.primaryKey');
    if (key.kind === 'current') return t('mapColumns.currentColumns');

    const column = columnsOf().selectById(key.columnIds[0]);
    return t('mapColumns.unique', { column: named(column) });
  };

  const mappingMessage = (emptyIndex: number): Message | null => {
    const { issues, notice, keyId, parentTable } = props.view;
    const { t } = i18n.value;
    const table = named(parentTable);

    if (issues.set.includes('selfOnly')) {
      return { text: t('mapColumns.selfOnly'), error: true };
    }
    if (issues.set.includes('duplicate')) {
      return { text: t('mapColumns.duplicate'), error: true };
    }
    if (keyId === null) {
      return { text: t('mapColumns.noKey', { table }), error: true };
    }

    switch (notice) {
      case 'notAKey':
        return { text: t('mapColumns.notAKey', { table }), error: false };
      case 'noKey':
        return { text: t('mapColumns.noKey', { table }), error: false };
      case 'fixMapping':
        return { text: t('mapColumns.fixMapping'), error: false };
      case 'addKeyToFix':
        return { text: t('mapColumns.addKeyToFix', { table }), error: false };
      default:
        // An empty row is the one thing left that keeps the button off.
        return emptyIndex === -1
          ? null
          : { text: t('mapColumns.pickEveryColumn'), error: false };
    }
  };

  const typeNote = (row: MappingRowView): TypeNoteView | null => {
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

    const { t } = i18n.value;
    return note.kind === 'becomes'
      ? {
          text: t('mapColumns.becomesType', {
            column: named(child),
            dataType: note.dataType,
          }),
          changes: true,
        }
      : {
          text: t('mapColumns.typesDiffer', {
            parentType: note.parentType,
            childType: note.childType,
          }),
          changes: false,
        };
  };

  /** A side of the mapping headed by its table, so either column reads as the table it is in. */
  const tableHeading = (table: Table, role: string) => (
    <div class={styles.heading}>
      <Icon class={styles.headingIcon} name="table-2" size={14} />
      <span class={styles.tableName} prop:dir="auto">
        {named(table)}
      </span>
      <span class={styles.role}>{role}</span>
    </div>
  );

  const parentCell = (row: MappingRowView, index: number) => {
    const { t } = i18n.value;
    const nameId = parentNameId(index);
    const dimCell = (text: string) => (
      <div class={styles.parent}>
        <span id={nameId} class={styles.dim}>
          {text}
        </span>
      </div>
    );
    if (row.invalid) return dimCell(t('mapColumns.invalid'));

    const column =
      row.parentColumnId === null
        ? undefined
        : columnsOf().selectById(row.parentColumnId);
    if (row.removedParent || !column) return dimCell(t('mapColumns.removed'));

    return (
      <div class={styles.parent}>
        <span
          id={nameId}
          class={
            isBlank(toNameLabel(app.value.store.state.settings, column).text)
              ? styles.dim
              : null
          }
          prop:dir="auto"
        >
          {named(column)}
        </span>
        <span class={styles.dataType} prop:dir="ltr">
          {column.dataType}
        </span>
      </div>
    );
  };

  const childOption = (column: Column, selected: string, used: Set<string>) => {
    const value = COLUMN_PREFIX + column.id;
    const inUse = used.has(column.id);
    const text = i18n.value.t(
      inUse ? 'mapColumns.columnOptionInUse' : 'mapColumns.columnOption',
      { name: named(column), dataType: column.dataType }
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
    const { t } = i18n.value;
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
      <Select class={styles.select}>
        <select
          aria-labelledby={`${labelId} ${parentNameId(index)}`}
          data-parent-column-id={parentColumnId ?? ''}
          bool:disabled={disabled}
          bool:data-autofocus={autofocus}
          on:change={handleChange}
        >
          <option
            prop:value={EMPTY_VALUE}
            prop:selected={selected === EMPTY_VALUE}
          >
            {t('mapColumns.pickColumn')}
          </option>
          {row.newColumnName ? (
            <option
              prop:value={NEW_VALUE}
              prop:selected={selected === NEW_VALUE}
            >
              {t('mapColumns.newColumn', { name: row.newColumnName })}
            </option>
          ) : null}
          {children.map(column => childOption(column, selected, used))}
          {row.removedChild ? (
            <option
              prop:value={selected}
              bool:disabled={true}
              prop:selected={true}
            >
              {t('mapColumns.removed')}
            </option>
          ) : null}
        </select>
      </Select>
    );
  };

  return () => {
    const { view, mode, stacked } = props;
    const { t, dir } = i18n.value;
    const { keyBindingMap } = app.value;
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
    const emptyIndex = rows.findIndex(
      row => !row.invalid && row.parentColumnId !== null && !row.pick
    );
    const message = mappingMessage(emptyIndex);
    // The arrow runs from the parent to the child, whichever side each stands on.
    const arrow = dir === 'rtl' ? 'arrow-left' : 'arrow-right';
    const confirmText = t(
      mode === 'create' ? 'mapColumns.map' : 'mapColumns.save'
    );

    return (
      <div
        class={['map-columns', styles.body]}
        style={{ 'color-scheme': props.isDarkMode ? 'dark' : 'light' }}
      >
        <div class={styles.header}>
          <h2 class={styles.title}>{t('mapColumns.title')}</h2>
          <button
            class={['map-columns-close', styles.close]}
            type="button"
            aria-label={t('common.close')}
            title={toShortcutTitle(
              keyBindingMap,
              t('common.close'),
              KeyBindingName.stop
            )}
            on:click={props.onCancel}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <div class={['map-columns-subtitle', styles.subtitle]}>
          {t('mapColumns.subtitle', {
            parent: named(parentTable),
            child: named(childTable),
            relationshipType: relationshipTypeName(
              relationshipType,
              i18n.value
            ),
          })}
        </div>
        {showReferences ? (
          <label class={['map-columns-references', styles.references]}>
            <span>{t('mapColumns.references')}</span>
            <Select class={styles.select}>
              <select
                aria-label={t('mapColumns.references')}
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
            </Select>
          </label>
        ) : null}
        <span id={labelId} hidden>
          {t('mapColumns.foreignKeyColumn')}
        </span>
        {rows.length ? (
          <div class={['map-columns-rows', styles.grid, { stacked }]}>
            {stacked ? null : (
              <>
                {tableHeading(parentTable, t('mapColumns.referencedColumn'))}
                <div />
                {tableHeading(childTable, t('mapColumns.foreignKeyColumn'))}
              </>
            )}
            {rows.map((row, index) => {
              const note = typeNote(row);
              return (
                <>
                  {parentCell(row, index)}
                  <Icon class={styles.arrow} name={arrow} size={14} />
                  {childSelect(row, index, childTable, index === emptyIndex)}
                  {note ? (
                    <div
                      class={[
                        'map-columns-note',
                        styles.note,
                        { changes: note.changes },
                      ]}
                    >
                      <Icon
                        name={note.changes ? 'refresh-cw' : 'triangle-alert'}
                        size={12}
                      />
                      <span>{note.text}</span>
                    </div>
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
            {t('mapColumns.changedRemotely')}
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
            {t('common.cancel')}
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

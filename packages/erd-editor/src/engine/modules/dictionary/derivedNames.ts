import type { AnyAction } from '@dineug/r-html';

import { ColumnOption } from '@/constants/schema';
import {
  changeTableNameAction,
  changeTableNameDerivedAction,
} from '@/engine/modules/table/atom.actions';
import type { ChangeColumnValuePayload } from '@/engine/modules/table-column/actions';
import {
  changeColumnNameAction,
  changeColumnNameDerivedAction,
} from '@/engine/modules/table-column/atom.actions';
import type { RootState } from '@/engine/state';
import type { Column, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';

import { derivePhysical } from './derive';
import { normalizeDictionaryName } from './dictionaryIndex';

/** What the dictionaries write into one name: the name, the flag and a domain. */
type NameWrites = {
  /** The physical name to write, null to leave the one held. */
  name: string | null;
  /** Whether to turn the derived flag on, which is off. */
  flag: boolean;
  /** The live domain the name's term gives, '' for none. */
  domainId: string;
};

/**
 * Derives a name from its logical name while it is empty or derived, or
 * whatever it holds when forced. A derived name turns the flag on, and so
 * does a forced one with a logical name; nothing derived leaves the name.
 */
function toNameWrites(
  state: RootState,
  name: string,
  derived: boolean,
  logicalName: string,
  force: boolean
): NameWrites | null {
  const hasLogicalName = normalizeDictionaryName(logicalName) !== '';
  if (force ? !hasLogicalName : name.trim() !== '' && !derived) return null;

  const physical = derivePhysical(state, logicalName);
  const physicalName = physical?.physicalName || null;

  return {
    name: physicalName !== null && physicalName !== name ? physicalName : null,
    flag: !derived && (force || physicalName !== null),
    domainId: physical?.domainId ?? '',
  };
}

/** A column's name writes, and the link to its term's domain for the caller to settle. */
export type ColumnNameWrites = {
  actions: AnyAction[];
  link: ChangeColumnValuePayload | null;
};

/** What the dictionaries write into a column for the logical name given. */
export function toColumnNameWrites(
  state: RootState,
  tableId: string,
  column: Column,
  logicalName: string,
  force = false
): ColumnNameWrites {
  const writes = toNameWrites(
    state,
    column.name,
    bHas(column.options, ColumnOption.nameDerived),
    logicalName,
    force
  );
  if (!writes) return { actions: [], link: null };

  const target = { tableId, id: column.id };
  const actions: AnyAction[] = [];
  if (writes.name !== null) {
    actions.push(changeColumnNameAction({ ...target, value: writes.name }));
  }
  if (writes.flag) {
    actions.push(changeColumnNameDerivedAction({ ...target, value: true }));
  }

  return {
    actions,
    link: writes.domainId ? { ...target, value: writes.domainId } : null,
  };
}

/** What the dictionaries write into a table's name for the logical name given. */
export function toTableNameWrites(
  state: RootState,
  table: Table,
  logicalName: string,
  force = false
): AnyAction[] {
  const writes = toNameWrites(
    state,
    table.name,
    table.nameDerived,
    logicalName,
    force
  );
  if (!writes) return [];

  const actions: AnyAction[] = [];
  if (writes.name !== null) {
    actions.push(changeTableNameAction({ id: table.id, value: writes.name }));
  }
  if (writes.flag) {
    actions.push(changeTableNameDerivedAction({ id: table.id, value: true }));
  }
  return actions;
}

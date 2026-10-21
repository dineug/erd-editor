import { query } from '@dineug/erd-editor-schema';
import type { AnyAction } from '@dineug/r-html';

import type { ChangeColumnValuePayload } from '@/engine/modules/table-column/actions';
import {
  changeColumnDataTypeAction,
  changeColumnDomainAction,
} from '@/engine/modules/table-column/atom.actions';
import { getDataTypeSyncColumns } from '@/engine/modules/table-column/utils/dataType';
import type { RootState } from '@/engine/state';

import { isListed } from './membership';

/** What one dispatch writes that a column's data type or its domain follows. */
export type DomainTypeWrites = {
  /** The data type each domain takes, by the domain's id. */
  domainTypes?: ReadonlyMap<string, string>;
  /** The columns linked to a domain, its id as the value, '' to unlink. */
  links?: ReadonlyArray<ChangeColumnValuePayload>;
  /** The columns given a data type directly, as a type cell writes one. */
  dataTypes?: ReadonlyArray<ChangeColumnValuePayload>;
  /**
   * The columns the same dispatch writes a type to otherwise, as a replay
   * does, which are sent the type worked out here even where they hold it now.
   */
  replaced?: ReadonlySet<string>;
};

const NO_DOMAIN_TYPES: ReadonlyMap<string, string> = new Map();
const NO_COLUMNS: ReadonlySet<string> = new Set();

/** A domain's type in one dispatch: the one it writes the domain, else the domain's own. */
export function domainTypeIn(
  state: RootState,
  domainTypes: ReadonlyMap<string, string>
) {
  const { domainEntities } = state.collections;
  return (id: string) =>
    domainTypes.get(id) ?? domainEntities[id]?.dataType ?? '';
}

/** How one dispatch reads a column's domain and a domain's type, its own writes first. */
function readDomains(
  state: RootState,
  domainTypes: ReadonlyMap<string, string>,
  links: ReadonlyArray<ChangeColumnValuePayload>
) {
  const { collections, doc } = state;
  const columns = query(collections).collection('tableColumnEntities');
  const linkOf = new Map(links.map(({ id, value }) => [id, value]));

  return {
    columns,
    isLiveDomain: (id: string) => id !== '' && isListed(doc.domainIds, id),
    domainTypeOf: domainTypeIn(state, domainTypes),
    domainIdOf: (id: string) =>
      linkOf.get(id) ?? columns.selectById(id)?.domainId ?? '',
  };
}

/**
 * The unlinks that close a dispatch writing these column types: each column
 * whose type then differs from the type of the domain it links, listed or
 * removed, read with the domain types and links the same dispatch writes.
 */
export function toDomainUnlinkActions(
  state: RootState,
  written: ReadonlyArray<ChangeColumnValuePayload>,
  {
    domainTypes = NO_DOMAIN_TYPES,
    links = [],
  }: Pick<DomainTypeWrites, 'domainTypes' | 'links'> = {}
): AnyAction[] {
  const { domainTypeOf, domainIdOf } = readDomains(state, domainTypes, links);

  return written
    .filter(({ id, value }) => {
      const domainId = domainIdOf(id);
      return domainId !== '' && domainTypeOf(domainId) !== value;
    })
    .map(({ tableId, id }) =>
      changeColumnDomainAction({ tableId, id, value: '' })
    );
}

/**
 * The column writes of one dispatch over all its rows: a column linked to a
 * domain it changes or links takes that type first, the sync spreads from it
 * without writing it again, and a written column off its domain's type unlinks.
 */
export function toDomainTypeActions(
  state: RootState,
  {
    domainTypes = NO_DOMAIN_TYPES,
    links = [],
    dataTypes = [],
    replaced = NO_COLUMNS,
  }: DomainTypeWrites
): AnyAction[] {
  const { collections, doc, settings } = state;
  const sentLinks = links.filter(
    ({ value }) => value === '' || isListed(doc.domainIds, value)
  );
  const { columns, isLiveDomain, domainTypeOf, domainIdOf } = readDomains(
    state,
    domainTypes,
    sentLinks
  );

  const settled = new Map<string, ChangeColumnValuePayload>();
  for (const payload of dataTypes) {
    settled.set(payload.id, payload);
  }
  for (const { tableId, id, value } of sentLinks) {
    if (value !== '') {
      settled.set(id, { tableId, id, value: domainTypeOf(value) });
    }
  }

  const changed = new Set([...domainTypes.keys()].filter(isLiveDomain));
  if (changed.size) {
    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(doc.tableIds);

    for (const table of tables) {
      for (const id of table.columnIds) {
        const domainId = domainIdOf(id);
        if (!settled.has(id) && changed.has(domainId)) {
          settled.set(id, {
            tableId: table.id,
            id,
            value: domainTypeOf(domainId),
          });
        }
      }
    }
  }

  const seeds = [...settled.values()];
  const payloads = settings.relationshipDataTypeSync
    ? getDataTypeSyncColumns(
        [...seeds],
        state,
        [],
        undefined,
        new Set(settled.keys())
      )
    : seeds;

  const direct = new Set(dataTypes.map(({ id }) => id));
  const written = payloads.filter(
    ({ id, value }) =>
      direct.has(id) ||
      replaced.has(id) ||
      columns.selectById(id)?.dataType !== value
  );
  const linkActions = sentLinks
    .filter(({ id, value }) => columns.selectById(id)?.domainId !== value)
    .map(changeColumnDomainAction);
  const unlinkActions = toDomainUnlinkActions(state, written, {
    domainTypes,
    links: sentLinks,
  });

  return [
    ...linkActions,
    ...written.map(changeColumnDataTypeAction),
    ...unlinkActions,
  ];
}

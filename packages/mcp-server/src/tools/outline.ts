import {
  defaultToWidth,
  measureTableSize,
  type RootState,
} from '@dineug/erd-editor/peer.js';
import { query } from '@dineug/erd-editor-schema';

import { MAX_READ_CHARS } from '@/tools/budget';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import {
  type AgentSnapshotIndex,
  type AgentSnapshotMemo,
  type AgentSnapshotRelationship,
  type AgentSnapshotSettings,
  type AgentSnapshotTable,
  relationshipTypeName,
  toSnapshotIndex,
  toSnapshotMemo,
  toSnapshotRelationship,
  toSnapshotSettings,
  toSnapshotTable,
} from '@/tools/snapshot';

/** The size a table takes on the ERD canvas. */
export type TableSize = { width: number; height: number };

export type ListedTable = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columnCount: number;
};

export type ListedRelationship = {
  id: string;
  relationshipType: string;
  startTableId: string;
  endTableId: string;
};

export type ListedIndex = {
  id: string;
  tableId: string;
  name: string;
  unique: boolean;
};

export type ListedMemo = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** How erd_list narrows a document too large to list whole. */
export type ListOptions = {
  readonly query?: string;
  readonly offset?: number;
  readonly limit?: number;
  readonly namesOnly?: boolean;
};

/** The tables one page of erd_list holds when the call sets no limit. */
export const DEFAULT_PAGE_SIZE = 100;

/**
 * What erd_list answers: the settings, the counts, and a page of tables with
 * their indexes and the relationships they own, then memos; columns are erd_get's.
 */
export type DocumentList = {
  settings: AgentSnapshotSettings;
  /** How many tables the document holds, so no one has to count them. */
  tableCount: number;
  relationshipCount: number;
  indexCount: number;
  memoCount: number;
  matchCount?: number;
  nextOffset?: number;
  note?: string;
  tables: ListedTable[];
  relationships: ListedRelationship[];
  indexes: ListedIndex[];
  memos: ListedMemo[];
};

/** What erd_list answers with namesOnly: the table names alone, which fit where rows do not. */
export type TableNameList = {
  tableCount: number;
  matchCount?: number;
  nextOffset?: number;
  note?: string;
  tableNames: string[];
};

export type DetailedTable = AgentSnapshotTable & TableSize;

/** The entities erd_get is asked for, by kind, tables by id or by name. */
export type EntityIds = {
  readonly tableIds?: readonly string[];
  readonly tableNames?: readonly string[];
  readonly relationshipIds?: readonly string[];
  readonly indexIds?: readonly string[];
  readonly memoIds?: readonly string[];
};

/**
 * What erd_get answers: only the kinds asked for, the ids and names that name
 * nothing live, and the ids one answer had no room for.
 */
export type EntityDetails = {
  tables?: DetailedTable[];
  relationships?: AgentSnapshotRelationship[];
  indexes?: AgentSnapshotIndex[];
  memos?: AgentSnapshotMemo[];
  missing?: string[];
  notReturned?: string[];
  note?: string;
};

type TableEntity = RootState['collections']['tableEntities'][string];
type RelationshipEntity =
  RootState['collections']['relationshipEntities'][string];
type IndexEntity = RootState['collections']['indexEntities'][string];
type MemoEntity = RootState['collections']['memoEntities'][string];

/**
 * A table's box as the table sort sizes it once the peer's hooks have measured
 * its text, which they do a few milliseconds after a load whatever the file
 * carried: the height exact, the width from about 10 px a character.
 */
export const tableSize = (table: TableEntity, state: RootState): TableSize =>
  measureTableSize(table, state, defaultToWidth);

type Select = ReturnType<typeof query>;

const LIST_TOOL = 'erd_list';
const GET_TOOL = 'erd_get';

/** Room kept for the note an answer may carry. */
const NOTE_ROOM = 700;

/** The characters a value takes in an answer, with the comma before it. */
const cost = (value: unknown) => JSON.stringify(value).length + 1;

/** The words of a query, lower case, once each. */
function queryWords(text: string): string[] {
  const words = [
    ...new Set(
      text
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(Boolean)
    ),
  ];
  if (!words.length) {
    throw new ToolError(
      ToolErrorCode.invalidArgs,
      LIST_TOOL,
      'query holds no word to look for'
    );
  }
  return words;
}

/**
 * The tables a query finds, best first: those whose names hold more of its
 * words, then by a score where a word in the name counts 4, in the comment 2
 * and in a column name or comment 1; ties keep document order.
 */
function searchTables(
  select: Select,
  tables: TableEntity[],
  text: string
): TableEntity[] {
  const words = queryWords(text);
  const inside = (value: string, word: string) =>
    value.toLowerCase().includes(word);

  return tables
    .map((table, order) => {
      const columns = select
        .collection('tableColumnEntities')
        .selectByIds(table.columnIds);
      let named = 0;
      let score = 0;
      for (const word of words) {
        if (inside(table.name, word)) {
          named++;
          score += 4;
        } else if (inside(table.comment, word)) {
          score += 2;
        } else if (
          columns.some(
            ({ name, comment }) => inside(name, word) || inside(comment, word)
          )
        ) {
          score += 1;
        }
      }
      return { table, order, named, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.named - a.named || b.score - a.score || a.order - b.order)
    .map(({ table }) => table);
}

/** The live tables, or those a query finds, in the order a list gives them. */
function candidates(state: RootState, text: string | undefined) {
  const select = query(state.collections);
  const tables = select
    .collection('tableEntities')
    .selectByIds(state.doc.tableIds);
  return {
    select,
    tables,
    found: text === undefined ? tables : searchTables(select, tables, text),
  };
}

const NO_MATCH =
  'No table matches the query. Each word is looked for inside table and column names and comments, in any case; try other words';

const SEARCH_HINT =
  ' query finds tables by a word in a table or column name or comment, and namesOnly lists table names alone.';

const count = (n: number, noun: string) =>
  `${n} ${noun}${n === 1 ? '' : noun.endsWith('x') ? 'es' : 's'}`;

/** A stretch of a list a page shows, one based: names 1 to 100 of 400. */
const span = (what: string, first: number, shown: number, of: string) =>
  `${what} ${first + 1} to ${first + shown} of ${of}`;

const nextPage = (nextOffset: number, searched: boolean) =>
  `; for the next page pass offset ${nextOffset}${searched ? ' with the same query' : ''}.`;

const toListedRelationship = ({
  id,
  relationshipType,
  start,
  end,
}: RelationshipEntity): ListedRelationship => ({
  id,
  relationshipType: relationshipTypeName(relationshipType),
  startTableId: start.tableId,
  endTableId: end.tableId,
});

const toListedIndex = ({
  id,
  tableId,
  name,
  unique,
}: IndexEntity): ListedIndex => ({ id, tableId, name, unique });

const toListedMemo = ({ id, ui }: MemoEntity): ListedMemo => ({
  id,
  x: ui.x,
  y: ui.y,
  width: ui.width,
  height: ui.height,
});

/** Entities grouped under a key, each group in the order the entities came. */
function groupBy<E>(entities: E[], keys: (entity: E) => Iterable<string>) {
  const groups = new Map<string, E[]>();
  for (const entity of entities) {
    for (const key of keys(entity)) {
      const group = groups.get(key);
      if (group) group.push(entity);
      else groups.set(key, [entity]);
    }
  }
  return groups;
}

/**
 * The relationships each table lists, every relationship with one of its
 * tables in the list: the one that has fewer relationships, so a table many
 * refer to lists few, ties going to the later one.
 */
function ownRelationships(
  relationships: RelationshipEntity[],
  found: TableEntity[]
): Map<string, RelationshipEntity[]> {
  const position = new Map(found.map(({ id }, at) => [id, at]));
  const degree = new Map<string, number>();
  for (const { start, end } of relationships) {
    for (const tableId of new Set([start.tableId, end.tableId])) {
      degree.set(tableId, (degree.get(tableId) ?? 0) + 1);
    }
  }
  const lighter = (a: string, b: string) => {
    const byDegree = degree.get(a)! - degree.get(b)!;
    return byDegree < 0 || (!byDegree && position.get(a)! > position.get(b)!)
      ? a
      : b;
  };

  return groupBy(relationships, ({ start, end }) => {
    const listed = [start.tableId, end.tableId].filter(id => position.has(id));
    return listed.length ? [listed.reduce(lighter)] : [];
  });
}

/**
 * What a page says of the relationships and indexes of its one table that did
 * not fit, and where to read them: a searched list gives a relationship to the
 * table the query found, the unsearched one to the table with fewer.
 */
function leftOutNote(
  table: ListedTable | undefined,
  { relationship, index }: { relationship: number; index: number },
  searched: boolean
): string {
  if (!table || !(relationship || index)) return '';
  const kinds = [
    ...(relationship ? [['relationship', relationship] as const] : []),
    ...(index ? [['index', index] as const] : []),
  ];
  const where = [
    ...(relationship
      ? [
          searched
            ? 'erd_list without query lists every relationship once'
            : 'erd_read sql with tableIds gives the foreign keys a table holds',
        ]
      : []),
    ...(index ? ['erd_read sql with its tableIds gives its indexes'] : []),
  ];
  return ` Table ${table.id} has more ${kinds.map(([noun]) => (noun === 'index' ? 'indexes' : `${noun}s`)).join(' and ')} than one read holds, so ${kinds.map(([noun, n]) => count(n, noun)).join(' and ')} of it ${relationship + index === 1 ? 'is' : 'are'} left out; ${where.join(', and ')}.`;
}

/**
 * One page of the document list: the tables, then, unsearched, the memos, from
 * offset on, at most limit of them and as many as one read holds. A table
 * brings its indexes and the relationships ownRelationships gives it.
 */
export function toDocumentList(
  state: RootState,
  { query: text, offset = 0, limit = DEFAULT_PAGE_SIZE }: ListOptions = {}
): DocumentList {
  const { settings, doc } = state;
  const searched = text !== undefined;
  const { select, tables: live, found } = candidates(state, text);
  const relationships = select
    .collection('relationshipEntities')
    .selectByIds(doc.relationshipIds);
  const indexes = select.collection('indexEntities').selectByIds(doc.indexIds);
  const memos = searched
    ? []
    : select.collection('memoEntities').selectByIds(doc.memoIds);
  const owned = ownRelationships(relationships, found);
  const indexesOf = groupBy(indexes, ({ tableId }) => [tableId]);

  const head = {
    settings: toSnapshotSettings(settings),
    tableCount: live.length,
    relationshipCount: relationships.length,
    indexCount: indexes.length,
    memoCount: doc.memoIds.length,
  };
  let used = cost(head) + NOTE_ROOM;
  const tables: ListedTable[] = [];
  const listedMemos: ListedMemo[] = [];
  const listed = new Set<string>();
  const listedIndexes = new Set<string>();
  const total = found.length + memos.length;
  const leftOut = { relationship: 0, index: 0 };
  let at = offset;

  for (; at < total && tables.length + listedMemos.length < limit; at++) {
    const first = !tables.length && !listedMemos.length;
    if (at >= found.length) {
      const memo = toListedMemo(memos[at - found.length]);
      if (!first && used + cost(memo) > MAX_READ_CHARS) break;
      used += cost(memo);
      listedMemos.push(memo);
      continue;
    }

    const table = found[at];
    const row: ListedTable = {
      id: table.id,
      name: table.name,
      x: table.ui.x,
      y: table.ui.y,
      ...tableSize(table, state),
      columnCount: select
        .collection('tableColumnEntities')
        .selectByIds(table.columnIds).length,
    };
    const extras = [
      ...(owned.get(table.id) ?? []).map(relationship => ({
        id: relationship.id,
        kind: 'relationship' as const,
        into: listed,
        cost: cost(toListedRelationship(relationship)),
      })),
      ...(indexesOf.get(table.id) ?? []).map(index => ({
        id: index.id,
        kind: 'index' as const,
        into: listedIndexes,
        cost: cost(toListedIndex(index)),
      })),
    ];
    const rowCost = extras.reduce((sum, extra) => sum + extra.cost, cost(row));
    if (!first && used + rowCost > MAX_READ_CHARS) break;

    // A table too large for a page on its own brings what of it fits.
    used += cost(row);
    tables.push(row);
    for (const extra of extras) {
      if (used + extra.cost > MAX_READ_CHARS) {
        leftOut[extra.kind]++;
        continue;
      }
      used += extra.cost;
      extra.into.add(extra.id);
    }
  }

  const nextOffset = at < total ? at : undefined;
  const firstMemo = Math.max(offset - found.length, 0);
  let note: string | undefined;
  if (!found.length && searched) {
    note = `${NO_MATCH}, or namesOnly for every table name.`;
  } else if (offset >= total && offset > 0) {
    note = `offset ${offset} is past the end of the ${
      searched
        ? `${count(found.length, 'table')} matching the query`
        : `${count(found.length, 'table')} and ${count(memos.length, 'memo')}`
    }.`;
  } else if (
    nextOffset !== undefined ||
    leftOut.relationship ||
    leftOut.index
  ) {
    const shown = [
      ...(tables.length
        ? [
            span(
              'tables',
              offset,
              tables.length,
              searched
                ? `${found.length} matching the query`
                : `${found.length}`
            ),
          ]
        : []),
      ...(listedMemos.length
        ? [span('memos', firstMemo, listedMemos.length, `${memos.length}`)]
        : []),
    ];
    note = `This page lists ${shown.join(' and ')}${
      nextOffset === undefined ? '.' : nextPage(nextOffset, searched)
    }${leftOutNote(tables[0], leftOut, searched)}${
      nextOffset === undefined ? '' : SEARCH_HINT
    }`;
  }

  return {
    ...head,
    ...(searched ? { matchCount: found.length } : {}),
    ...(nextOffset === undefined ? {} : { nextOffset }),
    ...(note ? { note } : {}),
    tables,
    relationships: relationships
      .filter(({ id }) => listed.has(id))
      .map(toListedRelationship),
    indexes: indexes
      .filter(({ id }) => listedIndexes.has(id))
      .map(toListedIndex),
    memos: listedMemos,
  };
}

/**
 * The table names alone, from offset on, at most limit of them and as many as
 * one read holds: every name of a schema of thousands in one or a few calls.
 */
export function toTableNameList(
  state: RootState,
  { query: text, offset = 0, limit = Infinity }: ListOptions = {}
): TableNameList {
  const searched = text !== undefined;
  const { tables: live, found } = candidates(state, text);
  let used = cost({ tableCount: live.length, matchCount: 0 }) + NOTE_ROOM;
  const tableNames: string[] = [];

  for (let at = offset; at < found.length && tableNames.length < limit; at++) {
    const nameCost = cost(found[at].name);
    if (tableNames.length && used + nameCost > MAX_READ_CHARS) break;
    used += nameCost;
    tableNames.push(found[at].name);
  }

  const end = offset + tableNames.length;
  const nextOffset = end < found.length ? end : undefined;
  const of = searched
    ? `${found.length} matching the query`
    : `${found.length}`;
  const note =
    !found.length && searched
      ? `${NO_MATCH}.`
      : offset >= found.length && offset > 0
        ? `offset ${offset} is past the end of the ${count(found.length, 'table name')}${searched ? ' matching the query' : ''}.`
        : nextOffset !== undefined
          ? `This page lists ${span('names', offset, tableNames.length, of)}${nextPage(nextOffset, searched)}`
          : undefined;

  return {
    tableCount: live.length,
    ...(searched ? { matchCount: found.length } : {}),
    ...(nextOffset === undefined ? {} : { nextOffset }),
    ...(note ? { note } : {}),
    tableNames,
  };
}

/**
 * The live tables the ids and names name, in the order asked, once each; a
 * name matches every table so named, in any case. What names nothing is
 * returned apart.
 */
export function findTables(
  state: RootState,
  { tableIds = [], tableNames = [] }: Pick<EntityIds, 'tableIds' | 'tableNames'>
): { ids: string[]; missing: string[] } {
  const live = query(state.collections)
    .collection('tableEntities')
    .selectByIds(state.doc.tableIds);
  const byName = groupBy(live, ({ name }) => [name.toLowerCase()]);
  const liveIds = new Set(live.map(({ id }) => id));
  const ids = new Set<string>();
  const missing = new Set<string>();

  for (const id of tableIds) {
    if (liveIds.has(id)) ids.add(id);
    else missing.add(id);
  }
  for (const name of tableNames) {
    const named = byName.get(name.toLowerCase());
    if (named) named.forEach(({ id }) => ids.add(id));
    else missing.add(name);
  }
  return { ids: [...ids], missing: [...missing] };
}

/** The ids asked for once each, in the order asked, split by whether a live list holds them. */
function partition(ids: readonly string[], live: readonly string[]) {
  const unique = [...new Set(ids)];
  const liveIds = new Set(live);
  return {
    found: unique.filter(id => liveIds.has(id)),
    missing: unique.filter(id => !liveIds.has(id)),
  };
}

/**
 * The entities named, in full, each kind in the order asked, as many as one
 * read holds, the rest in notReturned. An id counts only when its kind's live
 * list holds it, since a removed entity stays as an LWW tombstone.
 */
export function toEntityDetails(
  state: RootState,
  ids: EntityIds
): EntityDetails {
  const { doc, collections } = state;
  const select = query(collections);
  const missing = new Set<string>();

  const pick = (asked: readonly string[] | undefined, live: string[]) => {
    const { found, missing: absent } = partition(asked ?? [], live);
    absent.forEach(id => missing.add(id));
    return found;
  };

  let tables: TableEntity[] | undefined;
  if (ids.tableIds || ids.tableNames) {
    const found = findTables(state, ids);
    found.missing.forEach(id => missing.add(id));
    tables = select.collection('tableEntities').selectByIds(found.ids);
  }
  const relationships = ids.relationshipIds
    ? select
        .collection('relationshipEntities')
        .selectByIds(pick(ids.relationshipIds, doc.relationshipIds))
    : undefined;
  const indexes = ids.indexIds
    ? select
        .collection('indexEntities')
        .selectByIds(pick(ids.indexIds, doc.indexIds))
    : undefined;
  const memos = ids.memoIds
    ? select
        .collection('memoEntities')
        .selectByIds(pick(ids.memoIds, doc.memoIds))
    : undefined;

  // What the ids from each position on would cost, listed as notReturned.
  const asked = [
    ...(tables ?? []),
    ...(relationships ?? []),
    ...(indexes ?? []),
    ...(memos ?? []),
  ];
  const idsFrom: number[] = new Array(asked.length + 1).fill(0);
  for (let at = asked.length - 1; at >= 0; at--) {
    idsFrom[at] = idsFrom[at + 1] + cost(asked[at].id);
  }
  let used = NOTE_ROOM + cost([...missing]);
  if (used + idsFrom[0] > MAX_READ_CHARS) {
    throw new ToolError(
      ToolErrorCode.tooLarge,
      GET_TOOL,
      `erd_get was asked for ${asked.length + missing.size} entities, more than one answer can even name; ask for fewer at a time`
    );
  }

  const notReturned: string[] = [];
  let position = 0;
  let returned = 0;
  let full = false;

  /** Renders entities in order while one read holds them and the ids after them, then only names the rest. */
  const fit = <E extends { id: string }, R>(
    entities: E[],
    render: (entity: E) => R
  ): R[] => {
    const out: R[] = [];
    for (const entity of entities) {
      const after = idsFrom[++position];
      if (!full) {
        const rendered = render(entity);
        const entityCost = cost(rendered);
        // The first entity goes in whatever it costs, or a huge table could never be read.
        if (!returned || used + entityCost + after <= MAX_READ_CHARS) {
          used += entityCost;
          returned++;
          out.push(rendered);
          continue;
        }
        full = true;
      }
      notReturned.push(entity.id);
    }
    return out;
  };

  const details: EntityDetails = {};
  if (tables) {
    details.tables = fit(tables, table => {
      const { columns, ...rest } = toSnapshotTable(select, table);
      return { ...rest, ...tableSize(table, state), columns };
    });
  }
  if (relationships) {
    details.relationships = fit(relationships, toSnapshotRelationship);
  }
  if (indexes) {
    details.indexes = fit(indexes, index => toSnapshotIndex(select, index));
  }
  if (memos) details.memos = fit(memos, toSnapshotMemo);
  if (missing.size) details.missing = [...missing];
  if (notReturned.length) {
    details.notReturned = notReturned;
    details.note =
      'notReturned lists the ids this answer had no room for; ask for them in another call.';
  } else if (used > MAX_READ_CHARS) {
    details.note =
      'This answer is over one read because its one entity is; erd_read sql with tableIds gives a table as DDL, which is shorter.';
  }

  return details;
}

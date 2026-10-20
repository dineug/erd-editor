import {
  bHas,
  BracketType,
  ColumnOption,
  ColumnType,
  Database,
  Language,
  LockSettingType,
  NameCase,
  OrderType,
  ReferentialAction,
  RelationshipType,
  type RootState,
  Show,
} from '@dineug/erd-editor/peer.js';
import { query } from '@dineug/erd-editor-schema';

type Names = Readonly<Record<string, string | number>>;

export type AgentSnapshotColumn = {
  id: string;
  name: string;
  /** The name the logical view shows, '' for none. */
  logicalName: string;
  dataType: string;
  /** The domain that governs the data type, '' for none or one the document does not list. */
  domainId: string;
  default: string;
  comment: string;
  primaryKey: boolean;
  notNull: boolean;
  unique: boolean;
  autoIncrement: boolean;
  /** True while the dictionaries filled the name, so a new logical name derives it again. */
  nameDerived: boolean;
};

export type AgentSnapshotTable = {
  id: string;
  name: string;
  /** The name the logical view shows, '' for none. */
  logicalName: string;
  comment: string;
  color: string;
  /** The table group it is in, '' for none. */
  groupId: string;
  /** True while the dictionaries filled the name, so a new logical name derives it again. */
  nameDerived: boolean;
  x: number;
  y: number;
  columns: AgentSnapshotColumn[];
};

export type AgentSnapshotRelationship = {
  id: string;
  relationshipType: string;
  onDelete: string;
  onUpdate: string;
  start: { tableId: string; columnIds: string[] };
  end: { tableId: string; columnIds: string[] };
};

export type AgentSnapshotIndex = {
  id: string;
  tableId: string;
  name: string;
  unique: boolean;
  columns: Array<{ id: string; columnId: string; orderType: string }>;
};

export type AgentSnapshotMemo = {
  id: string;
  value: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** A word of the dictionary, which a logical name is composed of. */
export type AgentSnapshotWord = {
  id: string;
  name: string;
  abbreviation: string;
  englishName: string;
  description: string;
  synonyms: string;
  forbiddenWords: string;
};

/** A term of the dictionary, matched to a logical name by its text. */
export type AgentSnapshotTerm = {
  id: string;
  name: string;
  physicalName: string;
  /** The domain it gives a column, '' for none or one the document does not list. */
  domainId: string;
  description: string;
  synonyms: string;
};

/** A domain of the dictionary, whose data type every column linking it holds. */
export type AgentSnapshotDomain = {
  id: string;
  name: string;
  category: string;
  dataType: string;
  description: string;
};

/** A table group by its stored rect; the editor draws it grown to hold each member. */
export type AgentSnapshotTableGroup = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tableIds: string[];
};

export type AgentSnapshotSettings = {
  databaseName: string;
  database: string;
  language: string;
  tableNameCase: string;
  columnNameCase: string;
  bracketType: string;
  relationshipDataTypeSync: boolean;
  columnOrder: string[];
  show: Record<string, boolean>;
  maxWidthComment: number;
  lockSettings: Record<string, boolean>;
  /** The Schema SQL scripts erd_set_ddl_script sets, which erd_list leaves out. */
  ddlScripts: AgentSnapshotScripts;
};

/** The two Schema SQL scripts of a document, each empty while unset. */
export type AgentSnapshotScripts = { before: string; after: string };

/**
 * What an agent reads to edit: every entity and dictionary row under its id
 * and the settings as the file saves them, by enum name, leaving out what each
 * reader has its own: widths, stacking order, viewport, tab and name view.
 */
export type AgentSnapshot = {
  settings: AgentSnapshotSettings;
  tables: AgentSnapshotTable[];
  relationships: AgentSnapshotRelationship[];
  indexes: AgentSnapshotIndex[];
  memos: AgentSnapshotMemo[];
  tableGroups: AgentSnapshotTableGroup[];
  words: AgentSnapshotWord[];
  terms: AgentSnapshotTerm[];
  domains: AgentSnapshotDomain[];
};

/** The name a tool takes for a stored value, or the value itself when unnamed. */
const nameOf = (names: Names, value: string | number): string =>
  Object.keys(names).find(name => names[name] === value) ?? String(value);

const flagsOf = (names: Names, mask: number): Record<string, boolean> =>
  Object.fromEntries(
    Object.entries(names).map(([name, bit]) => [name, bHas(mask, Number(bit))])
  );

/** The name the tools take for a relationship type. */
export const relationshipTypeName = (value: number): string =>
  nameOf(RelationshipType, value);

/** The name the tools take for an ON DELETE or ON UPDATE action. */
export const referentialActionName = (value: number): string =>
  nameOf(ReferentialAction, value);

type Select = ReturnType<typeof query>;
type TableEntity = RootState['collections']['tableEntities'][string];
type RelationshipEntity =
  RootState['collections']['relationshipEntities'][string];
type IndexEntity = RootState['collections']['indexEntities'][string];
type MemoEntity = RootState['collections']['memoEntities'][string];
type TableGroupEntity = RootState['collections']['tableGroupEntities'][string];
type WordEntity = RootState['collections']['wordEntities'][string];
type TermEntity = RootState['collections']['termEntities'][string];
type DomainEntity = RootState['collections']['domainEntities'][string];

/** The field each code setting's lock holds, the view's and the tab's aside. */
const CODE_LOCK_FIELDS = [
  [LockSettingType.language, 'language'],
  [LockSettingType.tableNameCase, 'tableNameCase'],
  [LockSettingType.columnNameCase, 'columnNameCase'],
  [LockSettingType.bracketType, 'bracketType'],
] as const;

/**
 * The settings with each locked code setting at the value its lock holds, which
 * is what the file holds and every reader of it opens on, the screen of the
 * peer aside.
 */
export function toSavedSettings(
  settings: RootState['settings']
): RootState['settings'] {
  const saved = { ...settings };

  for (const [bit, field] of CODE_LOCK_FIELDS) {
    if (bHas(settings.lockSettings, bit)) {
      saved[field] = settings.lockedValues[field];
    }
  }
  return saved;
}

export function toSnapshotSettings(
  live: RootState['settings']
): AgentSnapshotSettings {
  const settings = toSavedSettings(live);

  return {
    databaseName: settings.databaseName,
    database: nameOf(Database, settings.database),
    language: nameOf(Language, settings.language),
    tableNameCase: nameOf(NameCase, settings.tableNameCase),
    columnNameCase: nameOf(NameCase, settings.columnNameCase),
    bracketType: nameOf(BracketType, settings.bracketType),
    relationshipDataTypeSync: settings.relationshipDataTypeSync,
    columnOrder: settings.columnOrder.map(type => nameOf(ColumnType, type)),
    show: flagsOf(Show, settings.show),
    maxWidthComment: settings.maxWidthComment,
    lockSettings: flagsOf(LockSettingType, settings.lockSettings),
    ddlScripts: toSnapshotScripts(settings),
  };
}

/** The scripts as the snapshot and erd_read's scripts format give them, no lock involved. */
export function toSnapshotScripts({
  ddlScripts,
}: RootState['settings']): AgentSnapshotScripts {
  return { before: ddlScripts?.before ?? '', after: ddlScripts?.after ?? '' };
}

/**
 * The group a table is in, '' for none: a groupId naming no group the document
 * lists reads as none, as the editor reads it.
 */
export const tableGroupIdOf = (
  { doc }: Pick<RootState, 'doc'>,
  { groupId }: TableEntity
): string => (groupId && doc.tableGroupIds.includes(groupId) ? groupId : '');

/** The live tables of each listed group, in document order. */
export function toTableGroupMembers(
  state: Pick<RootState, 'doc' | 'collections'>
): Map<string, string[]> {
  const members = new Map<string, string[]>(
    state.doc.tableGroupIds.map(id => [id, []])
  );
  for (const table of query(state.collections)
    .collection('tableEntities')
    .selectByIds(state.doc.tableIds)) {
    members.get(tableGroupIdOf(state, table))?.push(table.id);
  }
  return members;
}

/**
 * The domains a document lists, those a link reads by: a removed domain keeps
 * its links in memory, which the file form leaves out, so a reader sees none.
 */
export function liveDomainIds({
  doc,
  collections,
}: Pick<RootState, 'doc' | 'collections'>): ReadonlySet<string> {
  return new Set(
    query(collections)
      .collection('domainEntities')
      .selectByIds(doc.domainIds)
      .map(({ id }) => id)
  );
}

const linkedDomainId = (domains: ReadonlySet<string>, domainId: string) =>
  domainId && domains.has(domainId) ? domainId : '';

export function toSnapshotTable(
  select: Select,
  table: TableEntity,
  groupId: string,
  domains: ReadonlySet<string>
): AgentSnapshotTable {
  const { id, name, logicalName, comment, columnIds, nameDerived, ui } = table;

  return {
    id,
    name,
    logicalName,
    comment,
    color: ui.color,
    groupId,
    nameDerived,
    x: ui.x,
    y: ui.y,
    columns: select
      .collection('tableColumnEntities')
      .selectByIds(columnIds)
      .map(column => ({
        id: column.id,
        name: column.name,
        logicalName: column.logicalName,
        dataType: column.dataType,
        domainId: linkedDomainId(domains, column.domainId),
        default: column.default,
        comment: column.comment,
        primaryKey: bHas(column.options, ColumnOption.primaryKey),
        notNull: bHas(column.options, ColumnOption.notNull),
        unique: bHas(column.options, ColumnOption.unique),
        autoIncrement: bHas(column.options, ColumnOption.autoIncrement),
        nameDerived: bHas(column.options, ColumnOption.nameDerived),
      })),
  };
}

export function toSnapshotRelationship({
  id,
  relationshipType,
  onDelete,
  onUpdate,
  start,
  end,
}: RelationshipEntity): AgentSnapshotRelationship {
  return {
    id,
    relationshipType: relationshipTypeName(relationshipType),
    onDelete: referentialActionName(onDelete),
    onUpdate: referentialActionName(onUpdate),
    start: { tableId: start.tableId, columnIds: [...start.columnIds] },
    end: { tableId: end.tableId, columnIds: [...end.columnIds] },
  };
}

/** An index with the columns the file form keeps of it, those its table lists. */
export function toSnapshotIndex(
  select: Select,
  { id, tableId, name, unique, indexColumnIds }: IndexEntity
): AgentSnapshotIndex {
  const columnIds = new Set(
    select
      .collection('tableColumnEntities')
      .selectByIds(
        select.collection('tableEntities').selectById(tableId)?.columnIds ?? []
      )
      .map(({ id }) => id)
  );

  return {
    id,
    tableId,
    name,
    unique,
    columns: select
      .collection('indexColumnEntities')
      .selectByIds(indexColumnIds)
      .filter(({ columnId }) => columnIds.has(columnId))
      .map(({ id, columnId, orderType }) => ({
        id,
        columnId,
        orderType: nameOf(OrderType, orderType),
      })),
  };
}

export function toSnapshotMemo({
  id,
  value,
  ui,
}: MemoEntity): AgentSnapshotMemo {
  return {
    id,
    value,
    color: ui.color,
    x: ui.x,
    y: ui.y,
    width: ui.width,
    height: ui.height,
  };
}

export function toSnapshotTableGroup(
  { id, name, color, ui }: TableGroupEntity,
  tableIds: readonly string[]
): AgentSnapshotTableGroup {
  return {
    id,
    name,
    color,
    x: ui.x,
    y: ui.y,
    width: ui.width,
    height: ui.height,
    tableIds: [...tableIds],
  };
}

export const toSnapshotWord = ({
  id,
  name,
  abbreviation,
  englishName,
  description,
  synonyms,
  forbiddenWords,
}: WordEntity): AgentSnapshotWord => ({
  id,
  name,
  abbreviation,
  englishName,
  description,
  synonyms,
  forbiddenWords,
});

export const toSnapshotTerm = (
  { id, name, physicalName, domainId, description, synonyms }: TermEntity,
  domains: ReadonlySet<string>
): AgentSnapshotTerm => ({
  id,
  name,
  physicalName,
  domainId: linkedDomainId(domains, domainId),
  description,
  synonyms,
});

export const toSnapshotDomain = ({
  id,
  name,
  category,
  dataType,
  description,
}: DomainEntity): AgentSnapshotDomain => ({
  id,
  name,
  category,
  dataType,
  description,
});

type DocumentState = Pick<RootState, 'doc' | 'collections'>;

const liveTableIds = ({ doc, collections }: DocumentState) =>
  new Set(
    query(collections)
      .collection('tableEntities')
      .selectByIds(doc.tableIds)
      .map(({ id }) => id)
  );

/**
 * The relationships the file form keeps, those whose two tables are live, in
 * document order: a table removed as a peer related it leaves one behind.
 */
export function liveRelationships(state: DocumentState): RelationshipEntity[] {
  const tableIds = liveTableIds(state);
  return query(state.collections)
    .collection('relationshipEntities')
    .selectByIds(state.doc.relationshipIds)
    .filter(
      ({ start, end }) =>
        tableIds.has(start.tableId) && tableIds.has(end.tableId)
    );
}

/** The indexes the file form keeps, those on a live table, in document order. */
export function liveIndexes(state: DocumentState): IndexEntity[] {
  const tableIds = liveTableIds(state);
  return query(state.collections)
    .collection('indexEntities')
    .selectByIds(state.doc.indexIds)
    .filter(({ tableId }) => tableIds.has(tableId));
}

/** The live entities and dictionary rows of a document, as its id lists hold them, in their order. */
export function toAgentSnapshot(state: RootState): AgentSnapshot {
  const { settings, doc, collections } = state;
  const select = query(collections);
  const members = toTableGroupMembers(state);
  const domains = liveDomainIds(state);

  return {
    settings: toSnapshotSettings(settings),
    tables: select
      .collection('tableEntities')
      .selectByIds(doc.tableIds)
      .map(table =>
        toSnapshotTable(select, table, tableGroupIdOf(state, table), domains)
      ),
    relationships: liveRelationships(state).map(toSnapshotRelationship),
    indexes: liveIndexes(state).map(index => toSnapshotIndex(select, index)),
    memos: select
      .collection('memoEntities')
      .selectByIds(doc.memoIds)
      .map(toSnapshotMemo),
    tableGroups: select
      .collection('tableGroupEntities')
      .selectByIds(doc.tableGroupIds)
      .map(group => toSnapshotTableGroup(group, members.get(group.id) ?? [])),
    words: select
      .collection('wordEntities')
      .selectByIds(doc.wordIds)
      .map(toSnapshotWord),
    terms: select
      .collection('termEntities')
      .selectByIds(doc.termIds)
      .map(term => toSnapshotTerm(term, domains)),
    domains: select
      .collection('domainEntities')
      .selectByIds(doc.domainIds)
      .map(toSnapshotDomain),
  };
}

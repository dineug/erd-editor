import {
  bHas,
  BracketType,
  CanvasType,
  ColumnOption,
  ColumnType,
  Database,
  Language,
  NameCase,
  OrderType,
  RelationshipType,
  type RootState,
  SaveSettingType,
  Show,
} from '@dineug/erd-editor/peer.js';
import { query } from '@dineug/erd-editor-schema';

type Names = Readonly<Record<string, string | number>>;

export type AgentSnapshotColumn = {
  id: string;
  name: string;
  dataType: string;
  default: string;
  comment: string;
  primaryKey: boolean;
  notNull: boolean;
  unique: boolean;
  autoIncrement: boolean;
};

export type AgentSnapshotTable = {
  id: string;
  name: string;
  comment: string;
  color: string;
  x: number;
  y: number;
  zIndex: number;
  columns: AgentSnapshotColumn[];
};

export type AgentSnapshotRelationship = {
  id: string;
  relationshipType: string;
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
  zIndex: number;
};

export type AgentSnapshotSettings = {
  databaseName: string;
  database: string;
  canvasType: string;
  language: string;
  tableNameCase: string;
  columnNameCase: string;
  bracketType: string;
  relationshipDataTypeSync: boolean;
  relationshipOptimization: boolean;
  columnOrder: string[];
  show: Record<string, boolean>;
  maxWidthComment: number;
  ignoreSaveSettings: Record<string, boolean>;
};

/**
 * What an agent reads to edit: every value a tool can change, under the ids
 * and the enum names the tools take. Render derived widths and the viewport
 * are left out, since no tool sets them and they differ between replicas.
 */
export type AgentSnapshot = {
  settings: AgentSnapshotSettings;
  tables: AgentSnapshotTable[];
  relationships: AgentSnapshotRelationship[];
  indexes: AgentSnapshotIndex[];
  memos: AgentSnapshotMemo[];
};

/** The name a tool takes for a stored value, or the value itself when unnamed. */
const nameOf = (names: Names, value: string | number): string =>
  Object.keys(names).find(name => names[name] === value) ?? String(value);

const flagsOf = (names: Names, mask: number): Record<string, boolean> =>
  Object.fromEntries(
    Object.entries(names).map(([name, bit]) => [name, bHas(mask, Number(bit))])
  );

/** The live entities of a document, as its id lists hold them, in their order. */
export function toAgentSnapshot({
  settings,
  doc,
  collections,
}: RootState): AgentSnapshot {
  const select = query(collections);

  return {
    settings: {
      databaseName: settings.databaseName,
      database: nameOf(Database, settings.database),
      canvasType: nameOf(CanvasType, settings.canvasType),
      language: nameOf(Language, settings.language),
      tableNameCase: nameOf(NameCase, settings.tableNameCase),
      columnNameCase: nameOf(NameCase, settings.columnNameCase),
      bracketType: nameOf(BracketType, settings.bracketType),
      relationshipDataTypeSync: settings.relationshipDataTypeSync,
      relationshipOptimization: settings.relationshipOptimization,
      columnOrder: settings.columnOrder.map(type => nameOf(ColumnType, type)),
      show: flagsOf(Show, settings.show),
      maxWidthComment: settings.maxWidthComment,
      ignoreSaveSettings: flagsOf(SaveSettingType, settings.ignoreSaveSettings),
    },
    tables: select
      .collection('tableEntities')
      .selectByIds(doc.tableIds)
      .map(({ id, name, comment, columnIds, ui }) => ({
        id,
        name,
        comment,
        color: ui.color,
        x: ui.x,
        y: ui.y,
        zIndex: ui.zIndex,
        columns: select
          .collection('tableColumnEntities')
          .selectByIds(columnIds)
          .map(column => ({
            id: column.id,
            name: column.name,
            dataType: column.dataType,
            default: column.default,
            comment: column.comment,
            primaryKey: bHas(column.options, ColumnOption.primaryKey),
            notNull: bHas(column.options, ColumnOption.notNull),
            unique: bHas(column.options, ColumnOption.unique),
            autoIncrement: bHas(column.options, ColumnOption.autoIncrement),
          })),
      })),
    relationships: select
      .collection('relationshipEntities')
      .selectByIds(doc.relationshipIds)
      .map(({ id, relationshipType, start, end }) => ({
        id,
        relationshipType: nameOf(RelationshipType, relationshipType),
        start: { tableId: start.tableId, columnIds: [...start.columnIds] },
        end: { tableId: end.tableId, columnIds: [...end.columnIds] },
      })),
    indexes: select
      .collection('indexEntities')
      .selectByIds(doc.indexIds)
      .map(({ id, tableId, name, unique, indexColumnIds }) => ({
        id,
        tableId,
        name,
        unique,
        columns: select
          .collection('indexColumnEntities')
          .selectByIds(indexColumnIds)
          .map(({ id, columnId, orderType }) => ({
            id,
            columnId,
            orderType: nameOf(OrderType, orderType),
          })),
      })),
    memos: select
      .collection('memoEntities')
      .selectByIds(doc.memoIds)
      .map(({ id, value, ui }) => ({
        id,
        value,
        color: ui.color,
        x: ui.x,
        y: ui.y,
        width: ui.width,
        height: ui.height,
        zIndex: ui.zIndex,
      })),
  };
}

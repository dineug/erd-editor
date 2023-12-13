import { difference } from 'lodash-es';
import { nanoid } from 'nanoid';

import { propOr } from '@/helper';
import { type ERDEditorSchemaV2 } from '@/v2';
import {
  type ERDEditorSchemaV3,
  SchemaV3Constants,
  schemaV3Parser,
} from '@/v3';
import { createIndex } from '@/v3/parser/index.entity';
import { createIndexColumn } from '@/v3/parser/indexColumn.entity';
import { createMemo } from '@/v3/parser/memo.entity';
import { createRelationship } from '@/v3/parser/relationship.entity';
import { createTable } from '@/v3/parser/table.entity';
import { createColumn } from '@/v3/parser/tableColumn.entity';
import { CanvasType } from '@/v3/schema/settings';

export function v2ToV3(schemaV2: ERDEditorSchemaV2): ERDEditorSchemaV3 {
  const schemaV3 = schemaV3Parser({});

  assignCanvas(schemaV3.settings, schemaV2.canvas);
  assignTable(schemaV3, schemaV2.table);
  assignMemo(schemaV3, schemaV2.memo);
  assignRelationship(schemaV3, schemaV2.relationship);

  return schemaV3;
}

function assignCanvas(
  target: ERDEditorSchemaV3['settings'],
  source: ERDEditorSchemaV2['canvas']
) {
  target.width = source.width;
  target.height = source.height;
  target.scrollTop = source.scrollTop;
  target.scrollLeft = source.scrollLeft;
  target.zoomLevel = source.zoomLevel;
  target.databaseName = source.databaseName;
  target.canvasType = CanvasType.ERD;

  target.show = Object.keys(source.show).reduce((acc, key) => {
    const flag: boolean = propOr(source.show, key, false);

    if (flag) {
      const bit: number = propOr(SchemaV3Constants.Show, key, 0);
      return acc | bit;
    }

    return acc;
  }, 0);

  target.database =
    Reflect.get(SchemaV3Constants.Database, source.database) ??
    SchemaV3Constants.Database.MySQL;

  target.language =
    source.language === 'C#'
      ? SchemaV3Constants.Language.csharp
      : propOr(
          SchemaV3Constants.Language,
          source.language,
          SchemaV3Constants.Language.GraphQL
        );

  target.tableNameCase = propOr(
    SchemaV3Constants.NameCase,
    source.tableCase,
    SchemaV3Constants.NameCase.pascalCase
  );
  target.columnNameCase = propOr(
    SchemaV3Constants.NameCase,
    source.columnCase,
    SchemaV3Constants.NameCase.camelCase
  );
  target.bracketType = propOr(
    SchemaV3Constants.BracketType,
    source.bracketType,
    SchemaV3Constants.BracketType.none
  );

  target.relationshipDataTypeSync = source.setting.relationshipDataTypeSync;
  target.relationshipOptimization = source.setting.relationshipOptimization;

  const newColumnOrder = source.setting.columnOrder.map(
    key => SchemaV3Constants.ColumnType[key]
  );

  if (
    difference(SchemaV3Constants.ColumnTypeList, newColumnOrder).length === 0
  ) {
    target.columnOrder = newColumnOrder;
  }
}

function assignTable(
  target: ERDEditorSchemaV3,
  source: ERDEditorSchemaV2['table']
) {
  const tables = source.tables.filter(({ id }) => Boolean(id));
  const indexes = source.indexes.filter(({ id }) => Boolean(id));

  target.doc.tableIds = tables.map(({ id }) => id);
  target.doc.indexIds = indexes.map(({ id }) => id);

  for (const table of tables) {
    const newTable = createTable();

    newTable.id = table.id;
    newTable.name = table.name;
    newTable.comment = table.comment;
    newTable.columnIds = table.columns.map(({ id }) => id);
    newTable.seqColumnIds = [...newTable.columnIds];
    newTable.ui.y = table.ui.top;
    newTable.ui.x = table.ui.left;
    newTable.ui.zIndex = table.ui.zIndex;
    newTable.ui.widthName = table.ui.widthName;
    newTable.ui.widthComment = table.ui.widthComment;
    newTable.ui.color = table.ui.color ?? '';

    for (const column of table.columns) {
      const newColumn = createColumn();

      newColumn.id = column.id;
      newColumn.tableId = table.id;
      newColumn.name = column.name;
      newColumn.comment = column.comment;
      newColumn.dataType = column.dataType;
      newColumn.default = column.default;

      newColumn.options = Object.keys(column.option).reduce((acc, key) => {
        const flag: boolean = propOr(column.option, key, false);

        if (flag) {
          const bit: number = propOr(SchemaV3Constants.ColumnOption, key, 0);
          return acc | bit;
        }

        return acc;
      }, 0);

      newColumn.ui.widthName = column.ui.widthName;
      newColumn.ui.widthComment = column.ui.widthComment;
      newColumn.ui.widthDataType = column.ui.widthDataType;
      newColumn.ui.widthDefault = column.ui.widthDefault;

      if (column.ui.pfk) {
        newColumn.ui.keys =
          SchemaV3Constants.ColumnUIKey.primaryKey |
          SchemaV3Constants.ColumnUIKey.foreignKey;
      } else if (column.ui.pk) {
        newColumn.ui.keys = SchemaV3Constants.ColumnUIKey.primaryKey;
      } else if (column.ui.fk) {
        newColumn.ui.keys = SchemaV3Constants.ColumnUIKey.foreignKey;
      }

      target.collections.tableColumnEntities[newColumn.id] = newColumn;
    }

    target.collections.tableEntities[newTable.id] = newTable;
  }

  for (const index of indexes) {
    const newIndex = createIndex();

    newIndex.id = index.id;
    newIndex.name = index.name;
    newIndex.tableId = index.tableId;
    newIndex.unique = index.unique;

    for (const indexColumn of index.columns) {
      const id = nanoid();
      const newIndexColumn = createIndexColumn();

      newIndex.indexColumnIds.push(id);
      newIndex.seqIndexColumnIds.push(id);
      newIndexColumn.id = id;
      newIndexColumn.indexId = index.id;
      newIndexColumn.columnId = indexColumn.id;
      newIndexColumn.orderType = propOr(
        SchemaV3Constants.OrderType,
        indexColumn.orderType,
        SchemaV3Constants.OrderType.ASC
      );

      target.collections.indexColumnEntities[newIndexColumn.id] =
        newIndexColumn;
    }

    target.collections.indexEntities[newIndex.id] = newIndex;
  }
}

function assignMemo(
  target: ERDEditorSchemaV3,
  source: ERDEditorSchemaV2['memo']
) {
  const memos = source.memos.filter(({ id }) => Boolean(id));

  target.doc.memoIds = memos.map(({ id }) => id);

  for (const value of memos) {
    const newValue = createMemo();

    newValue.id = value.id;
    newValue.value = value.value;
    newValue.ui.y = value.ui.top;
    newValue.ui.x = value.ui.left;
    newValue.ui.width = value.ui.width;
    newValue.ui.height = value.ui.height;
    newValue.ui.zIndex = value.ui.zIndex;
    newValue.ui.color = value.ui.color ?? '';

    target.collections.memoEntities[newValue.id] = newValue;
  }
}

function assignRelationship(
  target: ERDEditorSchemaV3,
  source: ERDEditorSchemaV2['relationship']
) {
  const relationships = source.relationships.filter(({ id }) => Boolean(id));

  target.doc.relationshipIds = relationships.map(({ id }) => id);

  for (const value of relationships) {
    const newValue = createRelationship();

    newValue.id = value.id;
    newValue.identification = value.identification;

    newValue.relationshipType = propOr(
      SchemaV3Constants.RelationshipType,
      value.relationshipType,
      SchemaV3Constants.RelationshipType.ZeroN
    );
    newValue.startRelationshipType = propOr(
      SchemaV3Constants.StartRelationshipType,
      value.startRelationshipType === 'Ring' ? 'ring' : 'dash',
      SchemaV3Constants.StartRelationshipType.dash
    );

    newValue.start.tableId = value.start.tableId;
    newValue.start.columnIds = value.start.columnIds;
    newValue.start.x = value.start.x;
    newValue.start.y = value.start.y;
    newValue.start.direction = propOr(
      SchemaV3Constants.Direction,
      value.start.direction,
      SchemaV3Constants.Direction.bottom
    );

    newValue.end.tableId = value.end.tableId;
    newValue.end.columnIds = value.end.columnIds;
    newValue.end.x = value.end.x;
    newValue.end.y = value.end.y;
    newValue.end.direction = propOr(
      SchemaV3Constants.Direction,
      value.end.direction,
      SchemaV3Constants.Direction.bottom
    );

    target.collections.relationshipEntities[newValue.id] = newValue;
  }
}

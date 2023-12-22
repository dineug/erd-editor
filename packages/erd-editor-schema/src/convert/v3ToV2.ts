import { difference } from 'lodash-es';

import { propOr } from '@/helper';
import { query } from '@/query';
import { bHas } from '@/utils/bit';
import {
  type ERDEditorSchemaV2,
  SchemaV2Constants,
  schemaV2Parser,
} from '@/v2';
import { ColumnType } from '@/v2/schema/canvasEntity';
import { Direction, RelationshipType } from '@/v2/schema/relationshipEntity';
import { type ERDEditorSchemaV3, SchemaV3Constants } from '@/v3';

const ColumnTypeV3ToV2Map: Record<number, ColumnType> = {
  [SchemaV3Constants.ColumnType.columnName]: ColumnType.columnName,
  [SchemaV3Constants.ColumnType.columnDataType]: ColumnType.columnDataType,
  [SchemaV3Constants.ColumnType.columnDefault]: ColumnType.columnDefault,
  [SchemaV3Constants.ColumnType.columnComment]: ColumnType.columnComment,
  [SchemaV3Constants.ColumnType.columnAutoIncrement]:
    ColumnType.columnAutoIncrement,
  [SchemaV3Constants.ColumnType.columnUnique]: ColumnType.columnUnique,
  [SchemaV3Constants.ColumnType.columnNotNull]: ColumnType.columnNotNull,
};

const RelationshipTypeV3ToV2Map: Record<number, RelationshipType> = {
  [SchemaV3Constants.RelationshipType.ZeroOne]: RelationshipType.ZeroOne,
  [SchemaV3Constants.RelationshipType.ZeroN]: RelationshipType.ZeroN,
  [SchemaV3Constants.RelationshipType.OneOnly]: RelationshipType.OneOnly,
  [SchemaV3Constants.RelationshipType.OneN]: RelationshipType.OneN,
};

const DirectionV3ToV2Map: Record<number, Direction> = {
  [SchemaV3Constants.Direction.left]: Direction.left,
  [SchemaV3Constants.Direction.right]: Direction.right,
  [SchemaV3Constants.Direction.top]: Direction.top,
  [SchemaV3Constants.Direction.bottom]: Direction.bottom,
};

export function v3ToV2(schemaV3: ERDEditorSchemaV3): ERDEditorSchemaV2 {
  const schemaV2 = schemaV2Parser({});

  assignSettings(schemaV2.canvas, schemaV3.settings);
  assignTable(schemaV2, schemaV3);
  assignMemo(schemaV2, schemaV3);
  assignRelationship(schemaV2, schemaV3);

  return schemaV2;
}

function assignSettings(
  target: ERDEditorSchemaV2['canvas'],
  source: ERDEditorSchemaV3['settings']
) {
  target.width = source.width;
  target.height = source.height;
  target.scrollTop = source.scrollTop;
  target.scrollLeft = source.scrollLeft;
  target.zoomLevel = source.zoomLevel;
  target.databaseName = source.databaseName;
  target.canvasType = SchemaV2Constants.CanvasType.ERD;

  target.show.tableComment = bHas(
    source.show,
    SchemaV3Constants.Show.tableComment
  );
  target.show.columnComment = bHas(
    source.show,
    SchemaV3Constants.Show.columnComment
  );
  target.show.columnDataType = bHas(
    source.show,
    SchemaV3Constants.Show.columnDataType
  );
  target.show.columnDefault = bHas(
    source.show,
    SchemaV3Constants.Show.columnDefault
  );
  target.show.columnAutoIncrement = bHas(
    source.show,
    SchemaV3Constants.Show.columnAutoIncrement
  );
  target.show.columnPrimaryKey = bHas(
    source.show,
    SchemaV3Constants.Show.columnPrimaryKey
  );
  target.show.columnUnique = bHas(
    source.show,
    SchemaV3Constants.Show.columnUnique
  );
  target.show.columnNotNull = bHas(
    source.show,
    SchemaV3Constants.Show.columnNotNull
  );
  target.show.relationship = bHas(
    source.show,
    SchemaV3Constants.Show.relationship
  );

  const database = Object.keys(SchemaV3Constants.Database).find(key =>
    bHas(
      source.database,
      SchemaV3Constants.Database[key as keyof typeof SchemaV3Constants.Database]
    )
  );
  if (database && SchemaV2Constants.DatabaseList.includes(database)) {
    target.database = database as keyof typeof SchemaV2Constants.Database;
  }

  const language = Object.keys(SchemaV3Constants.Language).find(key =>
    bHas(
      source.language,
      SchemaV3Constants.Language[key as keyof typeof SchemaV3Constants.Language]
    )
  );
  if (language && SchemaV2Constants.LanguageList.includes(language)) {
    target.language = language as keyof typeof SchemaV2Constants.Language;
  }

  const tableNameCase = Object.keys(SchemaV3Constants.NameCase).find(key =>
    bHas(
      source.tableNameCase,
      SchemaV3Constants.NameCase[key as keyof typeof SchemaV3Constants.NameCase]
    )
  );
  if (tableNameCase && SchemaV2Constants.NameCaseList.includes(tableNameCase)) {
    target.tableCase = tableNameCase as keyof typeof SchemaV2Constants.NameCase;
  }

  const columnNameCase = Object.keys(SchemaV3Constants.NameCase).find(key =>
    bHas(
      source.columnNameCase,
      SchemaV3Constants.NameCase[key as keyof typeof SchemaV3Constants.NameCase]
    )
  );
  if (
    columnNameCase &&
    SchemaV2Constants.NameCaseList.includes(columnNameCase)
  ) {
    target.columnCase =
      columnNameCase as keyof typeof SchemaV2Constants.NameCase;
  }

  const bracketType = Object.keys(SchemaV3Constants.BracketType).find(key =>
    bHas(
      source.bracketType,
      SchemaV3Constants.BracketType[
        key as keyof typeof SchemaV3Constants.BracketType
      ]
    )
  );
  if (bracketType && SchemaV2Constants.BracketTypeList.includes(bracketType)) {
    target.bracketType =
      bracketType as keyof typeof SchemaV2Constants.BracketType;
  }

  target.setting.relationshipDataTypeSync = source.relationshipDataTypeSync;
  target.setting.relationshipOptimization = source.relationshipOptimization;

  const newColumnOrder = source.columnOrder.map(
    key => ColumnTypeV3ToV2Map[key]
  );
  if (
    difference(SchemaV2Constants.ColumnTypeList, newColumnOrder).length === 0
  ) {
    target.setting.columnOrder = newColumnOrder;
  }
}

function assignTable(
  target: ERDEditorSchemaV2,
  { doc: { tableIds, indexIds }, collections }: ERDEditorSchemaV3
) {
  target.table.tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .map(table => {
      const columns = query(collections)
        .collection('tableColumnEntities')
        .selectByIds(table.columnIds);

      return {
        id: table.id,
        name: table.name,
        comment: table.comment,
        columns: columns.map(column => ({
          id: column.id,
          name: column.name,
          comment: column.comment,
          dataType: column.dataType,
          default: column.default,
          option: {
            autoIncrement: bHas(
              column.options,
              SchemaV3Constants.ColumnOption.autoIncrement
            ),
            primaryKey: bHas(
              column.options,
              SchemaV3Constants.ColumnOption.primaryKey
            ),
            unique: bHas(column.options, SchemaV3Constants.ColumnOption.unique),
            notNull: bHas(
              column.options,
              SchemaV3Constants.ColumnOption.notNull
            ),
          },
          ui: {
            active: false,
            widthName: column.ui.widthName,
            widthDataType: column.ui.widthDataType,
            widthDefault: column.ui.widthDefault,
            widthComment: column.ui.widthComment,
            pk:
              bHas(column.ui.keys, SchemaV3Constants.ColumnUIKey.primaryKey) &&
              !bHas(column.ui.keys, SchemaV3Constants.ColumnUIKey.foreignKey),
            fk:
              bHas(column.ui.keys, SchemaV3Constants.ColumnUIKey.foreignKey) &&
              !bHas(column.ui.keys, SchemaV3Constants.ColumnUIKey.primaryKey),
            pfk:
              bHas(column.ui.keys, SchemaV3Constants.ColumnUIKey.primaryKey) &&
              bHas(column.ui.keys, SchemaV3Constants.ColumnUIKey.foreignKey),
          },
        })),
        ui: {
          active: false,
          top: table.ui.y,
          left: table.ui.x,
          zIndex: table.ui.zIndex,
          widthName: table.ui.widthName,
          widthComment: table.ui.widthComment,
          color: table.ui.color,
        },
      };
    });

  target.table.indexes = query(collections)
    .collection('indexEntities')
    .selectByIds(indexIds)
    .map(index => {
      return {
        id: index.id,
        name: index.name,
        tableId: index.tableId,
        unique: index.unique,
        columns: query(collections)
          .collection('indexColumnEntities')
          .selectByIds(index.indexColumnIds)
          .map(indexColumn => ({
            id: indexColumn.columnId,
            orderType: bHas(
              indexColumn.orderType,
              SchemaV3Constants.OrderType.ASC
            )
              ? SchemaV2Constants.OrderType.ASC
              : SchemaV2Constants.OrderType.DESC,
          })),
      };
    });
}

function assignMemo(
  target: ERDEditorSchemaV2,
  { doc: { memoIds }, collections }: ERDEditorSchemaV3
) {
  target.memo.memos = query(collections)
    .collection('memoEntities')
    .selectByIds(memoIds)
    .map(memo => ({
      id: memo.id,
      value: memo.value,
      ui: {
        active: false,
        top: memo.ui.y,
        left: memo.ui.x,
        width: memo.ui.width,
        height: memo.ui.height,
        zIndex: memo.ui.zIndex,
        color: memo.ui.color,
      },
    }));
}

function assignRelationship(
  target: ERDEditorSchemaV2,
  { doc: { relationshipIds }, collections }: ERDEditorSchemaV3
) {
  target.relationship.relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds)
    .map(relationship => ({
      id: relationship.id,
      identification: relationship.identification,
      relationshipType: propOr(
        RelationshipTypeV3ToV2Map,
        relationship.relationshipType,
        RelationshipType.ZeroN
      ),
      startRelationshipType: bHas(
        relationship.startRelationshipType,
        SchemaV3Constants.StartRelationshipType.dash
      )
        ? SchemaV2Constants.StartRelationshipType.Dash
        : SchemaV2Constants.StartRelationshipType.Ring,
      start: {
        tableId: relationship.start.tableId,
        columnIds: relationship.start.columnIds,
        x: relationship.start.x,
        y: relationship.start.y,
        direction: propOr(
          DirectionV3ToV2Map,
          relationship.start.direction,
          Direction.bottom
        ),
      },
      end: {
        tableId: relationship.end.tableId,
        columnIds: relationship.end.columnIds,
        x: relationship.end.x,
        y: relationship.end.y,
        direction: propOr(
          DirectionV3ToV2Map,
          relationship.end.direction,
          Direction.bottom
        ),
      },
    }));
}

import {
  isBoolean,
  isNill,
  isNumber,
  isObject,
  isString,
} from '@dineug/shared';
import { difference } from 'lodash-es';
import { DeepPartial } from 'utility-types';

import { assign, validString } from '@/helper';
import {
  BracketTypeList,
  CanvasEntity,
  CanvasTypeList,
  ColumnType,
  ColumnTypeList,
  DatabaseList,
  HighlightThemeList,
  LanguageList,
  NameCaseList,
} from '@/v2/schema/canvasEntity';

const createCanvasEntity = (): CanvasEntity => ({
  version: '2.2.11',
  width: 2000,
  height: 2000,
  scrollTop: 0,
  scrollLeft: 0,
  zoomLevel: 1,
  show: {
    tableComment: true,
    columnComment: true,
    columnDataType: true,
    columnDefault: true,
    columnAutoIncrement: false,
    columnPrimaryKey: true,
    columnUnique: false,
    columnNotNull: true,
    relationship: true,
  },
  database: 'MySQL',
  databaseName: '',
  canvasType: 'ERD',
  language: 'GraphQL',
  tableCase: 'pascalCase',
  columnCase: 'camelCase',
  highlightTheme: 'VS2015',
  bracketType: 'none',
  setting: {
    relationshipDataTypeSync: true,
    relationshipOptimization: false,
    columnOrder: [
      'columnName',
      'columnDataType',
      'columnNotNull',
      'columnUnique',
      'columnAutoIncrement',
      'columnDefault',
      'columnComment',
    ],
  },
  pluginSerializationMap: {},
});

export function createAndMergeCanvasEntity(
  json?: DeepPartial<CanvasEntity>
): CanvasEntity {
  const entity = createCanvasEntity();
  if (isNill(json)) return entity;

  const assignNumber = assign(isNumber, entity, json);
  const assignString = assign(isString, entity, json);
  const showAssignBoolean = assign(isBoolean, entity.show, json.show);
  const settingAssignBoolean = assign(isBoolean, entity.setting, json.setting);

  assignString('version');
  assignString('databaseName');
  assignNumber('width');
  assignNumber('height');
  assignNumber('scrollTop');
  assignNumber('scrollLeft');
  assignNumber('zoomLevel');

  assign(validString(DatabaseList), entity, json)('database');
  assign(validString(CanvasTypeList), entity, json)('canvasType');
  assign(validString(LanguageList), entity, json)('language');
  assign(validString(NameCaseList), entity, json)('tableCase');
  assign(validString(NameCaseList), entity, json)('columnCase');
  assign(validString(HighlightThemeList), entity, json)('highlightTheme');
  assign(validString(BracketTypeList), entity, json)('bracketType');

  showAssignBoolean('tableComment');
  showAssignBoolean('columnComment');
  showAssignBoolean('columnDataType');
  showAssignBoolean('columnDefault');
  showAssignBoolean('columnAutoIncrement');
  showAssignBoolean('columnPrimaryKey');
  showAssignBoolean('columnUnique');
  showAssignBoolean('columnNotNull');
  showAssignBoolean('relationship');

  settingAssignBoolean('relationshipDataTypeSync');
  settingAssignBoolean('relationshipOptimization');

  if (
    json.setting?.columnOrder &&
    ColumnTypeList.length === json.setting.columnOrder.length &&
    difference(ColumnTypeList, json.setting.columnOrder).length === 0
  ) {
    entity.setting.columnOrder = json.setting.columnOrder as ColumnType[];
  }

  if (isObject(json.pluginSerializationMap)) {
    const pluginSerializationMap = json.pluginSerializationMap as Record<
      string,
      string
    >;

    for (const key of Object.keys(pluginSerializationMap)) {
      const value = pluginSerializationMap[key];

      if (isString(value)) {
        entity.pluginSerializationMap[key] = value;
      }
    }
  }

  return entity;
}

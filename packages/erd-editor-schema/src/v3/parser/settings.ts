import { isArray, isBoolean, isNill, isNumber, isString } from '@dineug/shared';
import { difference } from 'lodash-es';

import { assign, validNumber } from '@/helper';
import { DeepPartial } from '@/internal-types';
import {
  BracketType,
  BracketTypeList,
  CanvasType,
  ColumnType,
  ColumnTypeList,
  Database,
  DatabaseList,
  Language,
  LanguageList,
  NameCase,
  NameCaseList,
  Settings,
  Show,
} from '@/v3/schema/settings';

const defaultShow =
  Show.tableComment |
  Show.columnComment |
  Show.columnDataType |
  Show.columnDefault |
  Show.columnPrimaryKey |
  Show.columnNotNull |
  Show.relationship;

const createSettings = (): Settings => ({
  width: 2000,
  height: 2000,
  scrollTop: 0,
  scrollLeft: 0,
  zoomLevel: 1,
  show: defaultShow,
  database: Database.MySQL,
  databaseName: '',
  canvasType: CanvasType.ERD,
  language: Language.GraphQL,
  tableCase: NameCase.pascalCase,
  columnCase: NameCase.camelCase,
  bracketType: BracketType.none,
  relationshipDataTypeSync: true,
  relationshipOptimization: false,
  columnOrder: [
    ColumnType.columnName,
    ColumnType.columnDataType,
    ColumnType.columnNotNull,
    ColumnType.columnUnique,
    ColumnType.columnAutoIncrement,
    ColumnType.columnDefault,
    ColumnType.columnComment,
  ],
});

export function createAndMergeSettings(json?: DeepPartial<Settings>): Settings {
  const settings = createSettings();
  if (isNill(json)) return settings;

  const assignNumber = assign(isNumber, settings, json);
  const assignString = assign(isString, settings, json);
  const assignBoolean = assign(isBoolean, settings, json);

  assignNumber('width');
  assignNumber('height');
  assignNumber('scrollTop');
  assignNumber('scrollLeft');
  assignNumber('zoomLevel');
  assignNumber('show');
  assignString('databaseName');
  assignString('canvasType');
  assignBoolean('relationshipDataTypeSync');
  assignBoolean('relationshipOptimization');

  assign(validNumber(DatabaseList), settings, json)('database');
  assign(validNumber(LanguageList), settings, json)('language');
  assign(validNumber(NameCaseList), settings, json)('tableCase');
  assign(validNumber(NameCaseList), settings, json)('columnCase');
  assign(validNumber(BracketTypeList), settings, json)('bracketType');

  if (
    isArray(json.columnOrder) &&
    ColumnTypeList.length === json.columnOrder.length &&
    difference(ColumnTypeList, json.columnOrder).length === 0
  ) {
    settings.columnOrder = settings.columnOrder;
  }

  return settings;
}

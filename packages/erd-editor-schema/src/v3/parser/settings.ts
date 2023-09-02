import {
  createInRange,
  isArray,
  isBoolean,
  isNill,
  isNumber,
  isString,
} from '@dineug/shared';
import { difference } from 'lodash-es';

import { assign, validNumber } from '@/helper';
import { DeepPartial } from '@/internal-types';
import {
  BracketType,
  BracketTypeList,
  CANVAS_SIZE_MAX,
  CANVAS_SIZE_MIN,
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
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
  tableNameCase: NameCase.pascalCase,
  columnNameCase: NameCase.camelCase,
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

const sizeInRange = createInRange(CANVAS_SIZE_MIN, CANVAS_SIZE_MAX);
const zoomInRange = createInRange(CANVAS_ZOOM_MIN, CANVAS_ZOOM_MAX);

export function createAndMergeSettings(json?: DeepPartial<Settings>): Settings {
  const settings = createSettings();
  if (isNill(json)) return settings;

  const assignNumber = assign(isNumber, settings, json);
  const assignString = assign(isString, settings, json);
  const assignBoolean = assign(isBoolean, settings, json);

  if (isNumber(json.width)) {
    settings.width = sizeInRange(json.width);
  }
  if (isNumber(json.height)) {
    settings.height = sizeInRange(json.height);
  }
  if (isNumber(json.zoomLevel)) {
    settings.zoomLevel = zoomInRange(json.zoomLevel);
  }

  assignNumber('scrollTop');
  assignNumber('scrollLeft');
  assignNumber('show');
  assignString('databaseName');
  assignString('canvasType');
  assignBoolean('relationshipDataTypeSync');
  assignBoolean('relationshipOptimization');

  assign(validNumber(DatabaseList), settings, json)('database');
  assign(validNumber(LanguageList), settings, json)('language');
  assign(validNumber(NameCaseList), settings, json)('tableNameCase');
  assign(validNumber(NameCaseList), settings, json)('columnNameCase');
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

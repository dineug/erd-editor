import { formatDistance } from '@/components/erd/content-compass/compassGeometry';
import { menus as columnNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/columnNameCaseMenus';
import { menus as languageMenus } from '@/components/generator-code/generator-code-context-menu/menus/languageMenus';
import { menus as tableNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/tableNameCaseMenus';
import { menus as bracketMenus } from '@/components/schema-sql/schema-sql-context-menu/menus/bracketMenus';
import { CanvasType, LockSettingType } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { toZoomFormat } from '@/utils/validation';

type LockedValues = RootState['settings']['lockedValues'];

export type LockSettingRow = {
  name: string;
  lockSettingType: number;
  toText: (values: LockedValues) => string;
};

/** The tab names the toolbar's titles give, the ERD shortened as the tab reads. */
const CanvasTypeToName: Record<string, string> = {
  [CanvasType.ERD]: 'ERD',
  [CanvasType.visualization]: 'Visualization',
  [CanvasType.schemaSQL]: 'Schema SQL',
  [CanvasType.generatorCode]: 'Code Generator',
  [CanvasType.settings]: 'Settings',
};

const nameOf = (
  menus: ReadonlyArray<{ name: string; value: number }>,
  value: number
) => menus.find(menu => menu.value === value)?.name ?? String(value);

/** A coordinate as the compass prints a distance, short past a thousand, signed. */
const formatCoordinate = (value: number) => {
  const label = formatDistance(Math.abs(value));
  return value < 0 && label !== '0' ? `-${label}` : label;
};

/**
 * The Settings tab's lock rows, one per lock, each naming the value it holds
 * by the name the menu that sets it gives.
 */
export const lockSettingRows: ReadonlyArray<LockSettingRow> = [
  {
    name: 'Viewport',
    lockSettingType: LockSettingType.viewport,
    toText: ({ zoomLevel, originX, originY }) =>
      `${toZoomFormat(zoomLevel)} · ${formatCoordinate(originX)}, ${formatCoordinate(originY)}`,
  },
  {
    name: 'Canvas Type',
    lockSettingType: LockSettingType.canvasType,
    toText: ({ canvasType }) => CanvasTypeToName[canvasType] ?? canvasType,
  },
  {
    name: 'Language',
    lockSettingType: LockSettingType.language,
    toText: ({ language }) => nameOf(languageMenus, language),
  },
  {
    name: 'Table Name Case',
    lockSettingType: LockSettingType.tableNameCase,
    toText: ({ tableNameCase }) => nameOf(tableNameCaseMenus, tableNameCase),
  },
  {
    name: 'Column Name Case',
    lockSettingType: LockSettingType.columnNameCase,
    toText: ({ columnNameCase }) => nameOf(columnNameCaseMenus, columnNameCase),
  },
  {
    name: 'Bracket Type',
    lockSettingType: LockSettingType.bracketType,
    toText: ({ bracketType }) => nameOf(bracketMenus, bracketType),
  },
];

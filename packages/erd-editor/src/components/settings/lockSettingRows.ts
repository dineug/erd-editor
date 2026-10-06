import { formatDistance } from '@/components/erd/content-compass/compassGeometry';
import { menus as columnNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/columnNameCaseMenus';
import { menus as languageMenus } from '@/components/generator-code/generator-code-context-menu/menus/languageMenus';
import { menus as tableNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/tableNameCaseMenus';
import { menus as bracketMenus } from '@/components/schema-sql/schema-sql-context-menu/menus/bracketMenus';
import { CanvasType, LockSettingType } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { type LabeledMenu, menuLabel } from '@/i18n/menuLabel';
import type { I18n, PlainMessageKey } from '@/i18n/translate';
import { toZoomFormat } from '@/utils/validation';

type LockedValues = RootState['settings']['lockedValues'];

type Translator = Pick<I18n, 't'>;

export type LockSettingRow = {
  nameKey: PlainMessageKey;
  lockSettingType: number;
  toText: (values: LockedValues, i18n: Translator) => string;
};

/**
 * The tab names the toolbar's titles give. The ERD tab is left out: the row
 * names it ERD as the tab reads, in every language.
 */
const CanvasTypeToMessageKey: Readonly<Record<string, PlainMessageKey>> = {
  [CanvasType.visualization]: 'common.tab.visualization',
  [CanvasType.schemaSQL]: 'common.tab.schemaSql',
  [CanvasType.generatorCode]: 'common.tab.codeGenerator',
  [CanvasType.settings]: 'common.tab.settings',
};

const canvasTypeText = (canvasType: string, i18n: Translator) => {
  if (canvasType === CanvasType.ERD) return 'ERD';

  const key = CanvasTypeToMessageKey[canvasType];
  return key ? i18n.t(key) : canvasType;
};

const nameOf = (
  menus: ReadonlyArray<LabeledMenu & { value: number }>,
  value: number,
  i18n: Translator
) => {
  const menu = menus.find(menu => menu.value === value);
  return menu ? menuLabel(i18n, menu) : String(value);
};

/** A coordinate as the compass prints a distance, short past a thousand, signed. */
const formatCoordinate = (value: number) => {
  const label = formatDistance(Math.abs(value));
  return value < 0 && label !== '0' ? `-${label}` : label;
};

/**
 * The Settings tab's lock rows, one per lock, each naming the value it holds
 * by the name the menu that sets it gives, in the reader's language.
 */
export const lockSettingRows: ReadonlyArray<LockSettingRow> = [
  {
    nameKey: 'settings.lockRow.viewport',
    lockSettingType: LockSettingType.viewport,
    toText: ({ zoomLevel, originX, originY }) =>
      `${toZoomFormat(zoomLevel)} · ${formatCoordinate(originX)}, ${formatCoordinate(originY)}`,
  },
  {
    nameKey: 'settings.lockRow.canvasType',
    lockSettingType: LockSettingType.canvasType,
    toText: ({ canvasType }, i18n) => canvasTypeText(canvasType, i18n),
  },
  {
    nameKey: 'common.codeLanguage',
    lockSettingType: LockSettingType.language,
    toText: ({ language }, i18n) => nameOf(languageMenus, language, i18n),
  },
  {
    nameKey: 'common.tableNameCase',
    lockSettingType: LockSettingType.tableNameCase,
    toText: ({ tableNameCase }, i18n) =>
      nameOf(tableNameCaseMenus, tableNameCase, i18n),
  },
  {
    nameKey: 'common.columnNameCase',
    lockSettingType: LockSettingType.columnNameCase,
    toText: ({ columnNameCase }, i18n) =>
      nameOf(columnNameCaseMenus, columnNameCase, i18n),
  },
  {
    nameKey: 'settings.lockRow.bracketType',
    lockSettingType: LockSettingType.bracketType,
    toText: ({ bracketType }, i18n) => nameOf(bracketMenus, bracketType, i18n),
  },
];

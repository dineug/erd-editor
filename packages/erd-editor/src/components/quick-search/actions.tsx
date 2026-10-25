import { query } from '@dineug/erd-editor-schema';

import { AppContext } from '@/components/appContext';
import { menus as databaseMenus } from '@/components/erd/erd-context-menu/menus/databaseMenus';
import { menus as drawRelationshipMenus } from '@/components/erd/erd-context-menu/menus/drawRelationshipMenus';
import { menus as tablePlacementMenus } from '@/components/erd/erd-context-menu/menus/tablePlacementMenus';
import { nameViewOptions } from '@/components/erd/nameViewOptions';
import { addTableGroupAndRename } from '@/components/erd/table-group/tableGroupName';
import { toggleExplorerSearch } from '@/components/explorer/explorerCommands';
import { menus as columnNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/columnNameCaseMenus';
import { menus as languageMenus } from '@/components/generator-code/generator-code-context-menu/menus/languageMenus';
import { menus as tableNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/tableNameCaseMenus';
import { toggleGeneratorCodePanel } from '@/components/generator-code/generatorCodeView';
import { readsBracket } from '@/components/generator-code/languageSettings';
import Icon from '@/components/primitives/icon/Icon';
import type { IconName } from '@/components/primitives/icon/icons';
import { menus as bracketMenus } from '@/components/schema-sql/schema-sql-context-menu/menus/bracketMenus';
import {
  isHeaderSupported,
  menus as headerMenus,
} from '@/components/schema-sql/schema-sql-context-menu/menus/headerMenus';
import {
  isStatementsSupported,
  menus as statementsMenus,
} from '@/components/schema-sql/schema-sql-context-menu/menus/statementsMenus';
import {
  schemaSQLViewOf,
  showSchemaSQLExport,
  toggleSchemaSQLPanel,
} from '@/components/schema-sql/schemaSQLView';
import { APPEARANCE_BUTTONS } from '@/components/theme-builder/ThemeBuilder';
import { CanvasType } from '@/constants/schema';
import { documentJsonOf } from '@/engine/documentJson';
import {
  rederiveNamesAction$,
  type RederiveNamesTarget,
  RederiveScope,
} from '@/engine/modules/dictionary/generator.actions';
import { changeDrawTableGroupAction } from '@/engine/modules/editor/atom.actions';
import { drawStartRelationshipAction$ } from '@/engine/modules/editor/generator.actions';
import { getSelectTypeIds } from '@/engine/modules/editor/utils/selection';
import { addMemoAction$ } from '@/engine/modules/memo/generator.actions';
import {
  changeBracketTypeAction,
  changeCanvasTypeAction,
  changeColumnNameCaseAction,
  changeDatabaseAction,
  changeLanguageAction,
  changeTableNameCaseAction,
  toNameViewModeAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { addTableGroupFromTablesAction$ } from '@/engine/modules/table-group/generator.actions';
import { RootState } from '@/engine/state';
import { type LocaleOption, LOCALES, SYSTEM_LOCALE } from '@/i18n/locales';
import { sourceI18n } from '@/i18n/source';
import type { I18n, PlainMessageKey } from '@/i18n/translate';
import {
  openAutomaticTablePlacementAction,
  openExportImageAction,
  setLocaleOptionAction,
  setThemeOptionsAction,
} from '@/utils/emitter';
import { exportJSON } from '@/utils/file/exportFile';
import {
  importAML,
  importDBML,
  importGraphQL,
  importJSON,
  type ImportMode,
  importSchemaSQL,
} from '@/utils/file/importFile';
import { isMemoShown } from '@/utils/memo';
import { resolveSchemaSQLOptions, schemaSQLSupport } from '@/utils/schema-sql';
import { isTableGroupShown } from '@/utils/tableGroup';
import { isTakenOver } from '@/utils/takeover';

import {
  type Action,
  createTableActions,
  named,
  type PalettePreferences,
} from './documentSearch';

/** A row opening a submenu, named as named() names it and known by its message key in any language. */
const submenuNamed = (
  i18n: Pick<I18n, 't'>,
  key: PlainMessageKey,
  keywordsKey?: PlainMessageKey
): Pick<Action, 'id' | 'name' | 'keywords' | 'alias'> => ({
  id: key,
  ...named(i18n, key, keywordsKey),
});

/** The five formats under Import, or under Import and Add for an append. */
function createImportActions(mode: ImportMode, i18n: I18n): Action[] {
  return [
    {
      icon: <Icon name="braces" size={16} />,
      name: 'json',
      perform: app => {
        importJSON(app, mode);
      },
    },
    {
      icon: <Icon name="database" size={16} />,
      ...named(i18n, 'common.tab.schemaSql'),
      perform: app => {
        importSchemaSQL(app, mode);
      },
    },
    {
      icon: <Icon name="code" size={16} />,
      ...named(i18n, { name: 'GraphQL' }, 'palette.keywords.graphql'),
      perform: app => {
        importGraphQL(app, mode);
      },
    },
    {
      icon: <Icon name="code" size={16} />,
      ...named(i18n, { name: 'DBML' }, 'palette.keywords.dbml'),
      perform: app => {
        importDBML(app, mode);
      },
    },
    {
      icon: <Icon name="code" size={16} />,
      ...named(i18n, { name: 'AML' }, 'palette.keywords.aml'),
      perform: app => {
        importAML(app, mode);
      },
    },
  ];
}

/** A submenu row's check, drawn beside the option in force, which the submenu opens on. */
const checkOf = (checked: boolean): Pick<Action, 'icon' | 'checked'> => ({
  icon: checked ? <Icon name="check" size={16} /> : null,
  checked,
});

/**
 * The palette's top level: the commands of every tab, then a jump to each
 * table, which only the # prefix lists, each in the reader's language. Theme
 * and Display Language show on every tab, each only while its picker is given.
 */
export function createScopeActions(
  app: AppContext,
  i18n: I18n = sourceI18n,
  preferences: PalettePreferences = {}
): Action[] {
  const { store, keyBindingMap } = app;
  const { settings } = store.state;

  return [
    {
      ...submenuNamed(i18n, 'palette.tab'),
      next: createTabActions(i18n),
    },
    {
      ...submenuNamed(i18n, 'common.nameView'),
      next: nameViewOptions.map<Action>(menu => ({
        ...checkOf(menu.value === settings.nameViewMode),
        ...named(i18n, menu.labelKey),
        perform: ({ store }) => {
          store.dispatch(
            toNameViewModeAction(store.state, menu.value, store.getReadonly())
          );
        },
      })),
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    ...createRederiveActions(i18n),
    {
      icon: <Icon name="database" size={16} />,
      ...submenuNamed(i18n, 'common.database'),
      next: databaseMenus.map<Action>(menu => ({
        ...checkOf(menu.value === settings.database),
        name: menu.name,
        perform: ({ store }) => {
          store.dispatch(
            changeDatabaseAction({
              value: menu.value,
            })
          );
        },
      })),
      filter: ({ store }) => {
        return (
          store.state.settings.canvasType === CanvasType.ERD ||
          store.state.settings.canvasType === CanvasType.schemaSQL ||
          store.state.settings.canvasType === CanvasType.generatorCode
        );
      },
    },
    {
      icon: <Icon name="file-input" size={16} />,
      ...submenuNamed(i18n, 'common.import'),
      next: createImportActions('replace', i18n),
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    {
      icon: <Icon name="file-input" size={16} />,
      ...submenuNamed(i18n, 'common.importAndAdd'),
      next: createImportActions('append', i18n),
      filter: ({ store }) => {
        return (
          store.state.settings.canvasType === CanvasType.ERD &&
          !store.getReadonly()
        );
      },
    },
    {
      icon: <Icon name="file-output" size={16} />,
      ...submenuNamed(i18n, 'common.export'),
      next: [
        {
          icon: <Icon name="braces" size={16} />,
          name: 'json',
          perform: ({ store }) => {
            exportJSON(
              documentJsonOf(store),
              store.state.settings.databaseName
            );
          },
        },
        {
          icon: <Icon name="database" size={16} />,
          ...named(i18n, 'common.tab.schemaSql'),
          perform: showSchemaSQLExport,
        },
        {
          icon: <Icon name="file-image" size={16} />,
          ...named(i18n, 'common.image', 'palette.keywords.image'),
          perform: ({ emitter }) => {
            emitter.emit(openExportImageAction());
          },
        },
      ],
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    {
      icon: <Icon name="table-2" size={16} />,
      ...named(i18n, 'common.newTable'),
      shortcut: keyBindingMap.addTable[0]?.shortcut,
      perform: ({ store }) => {
        store.dispatch(addTableAction$());
      },
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    {
      icon: <Icon name="sticky-note" size={16} />,
      ...named(i18n, 'common.newMemo'),
      shortcut: keyBindingMap.addMemo[0]?.shortcut,
      perform: ({ store }) => {
        store.dispatch(addMemoAction$());
      },
      filter: ({ store }) => {
        return (
          store.state.settings.canvasType === CanvasType.ERD &&
          isMemoShown(store.state)
        );
      },
    },
    {
      icon: <Icon name="group" size={16} />,
      ...named(i18n, 'common.newTableGroup'),
      shortcut: keyBindingMap.addTableGroup[0]?.shortcut,
      perform: ({ store }) => {
        store.dispatch(changeDrawTableGroupAction({ value: true }));
      },
      filter: canAddTableGroup,
    },
    {
      icon: <Icon name="group" size={16} />,
      ...named(i18n, 'palette.groupSelectedTables'),
      shortcut: keyBindingMap.groupSelectedTables[0]?.shortcut,
      perform: ({ store }) => {
        addTableGroupAndRename(store, addTableGroupFromTablesAction$());
      },
      filter: app => canAddTableGroup(app) && hasSelectedTable(app),
    },
    ...drawRelationshipMenus.map<Action>(menu => ({
      icon: <Icon name={menu.iconName} size={16} />,
      ...named(i18n, menu, 'common.relationship'),
      shortcut: keyBindingMap[menu.keyBindingName][0]?.shortcut,
      perform: ({ store }) => {
        store.dispatch(drawStartRelationshipAction$(menu.relationshipType));
      },
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    })),
    {
      icon: <Icon name="wand-sparkles" size={16} />,
      ...submenuNamed(i18n, 'common.autoLayout'),
      next: tablePlacementMenus.map<Action>(menu => ({
        icon: <Icon name={menu.iconName} size={16} />,
        ...named(i18n, menu),
        perform: ({ emitter }) => {
          emitter.emit(
            openAutomaticTablePlacementAction({ placement: menu.placement })
          );
        },
      })),
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    {
      icon: <Icon name="brackets" size={16} />,
      ...submenuNamed(i18n, 'common.bracket'),
      next: bracketMenus.map<Action>(menu => ({
        ...checkOf(menu.value === settings.bracketType),
        ...named(i18n, menu),
        perform: ({ store }) => {
          store.dispatch(
            changeBracketTypeAction({
              value: menu.value,
            })
          );
        },
      })),
      filter: app => isSchemaSQLTab(app) || readsBracketHere(app),
    },
    ...createSchemaSQLActions(app, i18n),
    {
      icon: <Icon name="code" size={16} />,
      ...submenuNamed(i18n, 'common.codeLanguage'),
      next: languageMenus.map<Action>(menu => ({
        ...checkOf(menu.value === settings.language),
        name: menu.name,
        perform: ({ store }) => {
          store.dispatch(
            changeLanguageAction({
              value: menu.value,
            })
          );
        },
      })),
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.generatorCode;
      },
    },
    {
      ...submenuNamed(i18n, 'common.tableNameCase'),
      next: tableNameCaseMenus.map<Action>(menu => ({
        ...checkOf(menu.value === settings.tableNameCase),
        ...named(i18n, menu),
        perform: ({ store }) => {
          store.dispatch(
            changeTableNameCaseAction({
              value: menu.value,
            })
          );
        },
      })),
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.generatorCode;
      },
    },
    {
      ...submenuNamed(i18n, 'common.columnNameCase'),
      next: columnNameCaseMenus.map<Action>(menu => ({
        ...checkOf(menu.value === settings.columnNameCase),
        ...named(i18n, menu),
        perform: ({ store }) => {
          store.dispatch(
            changeColumnNameCaseAction({
              value: menu.value,
            })
          );
        },
      })),
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.generatorCode;
      },
    },
    {
      icon: <Icon name="panel-right" size={16} />,
      ...named(
        i18n,
        'palette.codeGeneratorOptionsPanel',
        'palette.keywords.codeGeneratorOptionsPanel'
      ),
      perform: toggleGeneratorCodePanel,
      filter: isGeneratorCodeTab,
    },
    {
      icon: <Icon name="list-tree" size={16} />,
      ...named(i18n, 'explorer.toggle', 'palette.keywords.explorer'),
      shortcut: keyBindingMap.findReplace[0]?.shortcut,
      perform: ({ store, emitter }) => toggleExplorerSearch(store, emitter),
      filter: canOpenExplorer,
    },
    ...createPreferenceActions(i18n, preferences),
    ...createTableActions(app, i18n),
  ];
}

const isSchemaSQLTab = ({ store }: AppContext) =>
  store.state.settings.canvasType === CanvasType.schemaSQL;

const isGeneratorCodeTab = ({ store }: AppContext) =>
  store.state.settings.canvasType === CanvasType.generatorCode;

/** The Code Generator tab of a language that quotes names by the bracket type. */
const readsBracketHere = (app: AppContext) =>
  isGeneratorCodeTab(app) && readsBracket(app.store.state.settings.language);

/** Whether a group may be made: on the ERD tab, showing its groups, of an editor that is not readonly. */
const canAddTableGroup = ({ store }: AppContext) =>
  store.state.settings.canvasType === CanvasType.ERD &&
  isTableGroupShown(store.state) &&
  !store.getReadonly();

const hasSelectedTable = ({ store }: AppContext) => {
  const { doc, editor } = store.state;
  return getSelectTypeIds(editor.selectedMap).tableIds.some(id =>
    doc.tableIds.includes(id)
  );
};

/** What one of the four derivations again covers now, or null while it has nothing to cover. */
type RederiveTargetOf = (state: RootState) => RederiveNamesTarget | null;

/** The focused column, while its table is listed and still holds it. */
const focusedColumnTarget: RederiveTargetOf = ({
  doc,
  editor,
  collections,
}) => {
  const { focusTable } = editor;
  if (!focusTable?.columnId || !doc.tableIds.includes(focusTable.tableId)) {
    return null;
  }

  const table = query(collections)
    .collection('tableEntities')
    .selectById(focusTable.tableId);
  return table?.columnIds.includes(focusTable.columnId)
    ? {
        scope: RederiveScope.column,
        tableId: focusTable.tableId,
        columnId: focusTable.columnId,
      }
    : null;
};

const focusedTableTarget: RederiveTargetOf = ({ doc, editor }) => {
  const tableId = editor.focusTable?.tableId;
  return tableId && doc.tableIds.includes(tableId)
    ? { scope: RederiveScope.table, tableId }
    : null;
};

/** The selected tables, while two or more of them are listed. */
const selectionTarget: RederiveTargetOf = ({ doc, editor }) =>
  getSelectTypeIds(editor.selectedMap).tableIds.filter(id =>
    doc.tableIds.includes(id)
  ).length > 1
    ? { scope: RederiveScope.selection }
    : null;

const documentTarget: RederiveTargetOf = ({ doc }) =>
  doc.tableIds.length ? { scope: RederiveScope.document } : null;

const REDERIVE_ROWS: ReadonlyArray<{
  labelKey: PlainMessageKey;
  keywordsKey: PlainMessageKey;
  targetOf: RederiveTargetOf;
}> = [
  {
    labelKey: 'common.derivePhysicalName',
    keywordsKey: 'palette.keywords.deriveColumn',
    targetOf: focusedColumnTarget,
  },
  {
    labelKey: 'common.derivePhysicalNames',
    keywordsKey: 'palette.keywords.deriveTable',
    targetOf: focusedTableTarget,
  },
  {
    labelKey: 'common.derivePhysicalNames',
    keywordsKey: 'palette.keywords.deriveSelection',
    targetOf: selectionTarget,
  },
  {
    labelKey: 'common.derivePhysicalNames',
    keywordsKey: 'palette.keywords.deriveDocument',
    targetOf: documentTarget,
  },
];

/**
 * A derivation again of the focused column, the focused table, the selected
 * tables and the document, each told apart by its keywords and shown on the
 * ERD tab of an editor that is not readonly while it has something to cover.
 */
function createRederiveActions(i18n: Pick<I18n, 't'>): Action[] {
  return REDERIVE_ROWS.map<Action>(({ labelKey, keywordsKey, targetOf }) => ({
    icon: <Icon name="refresh-cw" size={16} />,
    ...named(i18n, labelKey, keywordsKey),
    perform: ({ store }) => {
      const target = targetOf(store.state);
      if (target) store.dispatch(rederiveNamesAction$(target));
    },
    filter: ({ store }) =>
      store.state.settings.canvasType === CanvasType.ERD &&
      !store.getReadonly() &&
      targetOf(store.state) !== null,
  }));
}

/**
 * The Schema SQL tab's own rows, the statements and the header listing only
 * what the database writes, checked as it writes them, and the options panel
 * toggle, each only on the Schema SQL tab.
 */
function createSchemaSQLActions(app: AppContext, i18n: I18n): Action[] {
  const { settings } = app.store.state;
  const view = schemaSQLViewOf(app);
  const resolved = resolveSchemaSQLOptions(
    settings.database,
    view,
    settings.databaseName
  );
  const support = schemaSQLSupport(settings.database);

  return [
    {
      ...submenuNamed(
        i18n,
        'palette.schemaSqlStatements',
        'palette.keywords.schemaSqlStatements'
      ),
      next: statementsMenus
        .filter(menu => isStatementsSupported(support, menu.id))
        .map<Action>(menu => ({
          ...checkOf(menu.id === resolved.statements),
          name: menu.name,
          perform: app => {
            schemaSQLViewOf(app).statements = menu.id;
          },
        })),
      filter: isSchemaSQLTab,
    },
    {
      ...submenuNamed(
        i18n,
        'palette.schemaSqlHeader',
        'palette.keywords.schemaSqlHeader'
      ),
      next: headerMenus
        .filter(menu => isHeaderSupported(support, menu.id))
        .map<Action>(menu => ({
          ...checkOf(menu.id === resolved.header),
          ...named(i18n, menu),
          perform: app => {
            schemaSQLViewOf(app).header = menu.id;
          },
        })),
      filter: isSchemaSQLTab,
    },
    {
      icon: <Icon name="panel-right" size={16} />,
      ...named(
        i18n,
        'palette.schemaSqlOptionsPanel',
        'palette.keywords.schemaSqlOptionsPanel'
      ),
      perform: toggleSchemaSQLPanel,
      filter: isSchemaSQLTab,
    },
  ];
}

/**
 * Theme and Display Language, each only while the element offers its picker,
 * with a check on the option in force. A pick goes through the emitter as the
 * pickers' own do, so the host hears it; a language is named in itself.
 */
export function createPreferenceActions(
  i18n: I18n,
  { appearance, locale }: PalettePreferences
): Action[] {
  const actions: Action[] = [];

  if (appearance !== undefined) {
    actions.push({
      icon: <Icon name="contrast" size={16} />,
      ...submenuNamed(i18n, 'common.theme'),
      next: APPEARANCE_BUTTONS.map<Action>(option => ({
        ...checkOf(option.appearance === appearance),
        ...named(i18n, option.labelKey),
        perform: ({ emitter }) => {
          emitter.emit(
            setThemeOptionsAction({ appearance: option.appearance })
          );
        },
      })),
    });
  }

  if (locale !== undefined) {
    const pick =
      (option: LocaleOption): Action['perform'] =>
      ({ emitter }) => {
        emitter.emit(setLocaleOptionAction({ locale: option }));
      };

    actions.push({
      icon: <Icon name="languages" size={16} />,
      ...submenuNamed(i18n, 'common.displayLanguage'),
      next: [
        {
          ...checkOf(locale === SYSTEM_LOCALE),
          ...named(i18n, 'common.system'),
          perform: pick(SYSTEM_LOCALE),
        },
        ...LOCALES.map<Action>(({ code, label, english }) => ({
          ...checkOf(locale === code),
          name: label,
          alias: [english, code],
          perform: pick(code),
        })),
      ],
    });
  }

  return actions;
}

/** Whether the Toggle Explorer row would open the Explorer: an overlay taking the canvas over keeps it shut. */
const canOpenExplorer = ({ store }: AppContext) => !isTakenOver(store.state);

/** The six tabs in the toolbar's order. */
const TABS: ReadonlyArray<{
  canvasType: string;
  icon: IconName;
  labelKey: PlainMessageKey;
}> = [
  { canvasType: CanvasType.ERD, icon: 'workflow', labelKey: 'common.tab.erd' },
  {
    canvasType: CanvasType.visualization,
    icon: 'share-2',
    labelKey: 'common.tab.visualization',
  },
  {
    canvasType: CanvasType.schemaSQL,
    icon: 'database',
    labelKey: 'common.tab.schemaSql',
  },
  {
    canvasType: CanvasType.generatorCode,
    icon: 'code',
    labelKey: 'common.tab.codeGenerator',
  },
  {
    canvasType: CanvasType.dictionary,
    icon: 'book-type',
    labelKey: 'common.tab.dictionary',
  },
  {
    canvasType: CanvasType.settings,
    icon: 'settings',
    labelKey: 'common.tab.settings',
  },
];

/** The six tabs the Tab row opens, each but the one shown. */
export function createTabActions(i18n: I18n = sourceI18n): Action[] {
  return TABS.map<Action>(({ canvasType, icon, labelKey }) => ({
    icon: <Icon name={icon} size={16} />,
    ...named(i18n, labelKey),
    perform: ({ store }) => {
      store.dispatch(changeCanvasTypeAction({ value: canvasType }));
    },
    filter: ({ store }) => {
      return store.state.settings.canvasType !== canvasType;
    },
  }));
}

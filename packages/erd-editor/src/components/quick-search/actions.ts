import { query, toJson } from '@dineug/erd-editor-schema';
import { DOMTemplateLiterals, html } from '@dineug/r-html';
import Fues from 'fuse.js';
import { isEmpty } from 'lodash-es';

import { AppContext } from '@/components/appContext';
import { menus as databaseMenus } from '@/components/erd/erd-context-menu/menus/databaseMenus';
import { menus as drawRelationshipMenus } from '@/components/erd/erd-context-menu/menus/drawRelationshipMenus';
import { menus as columnNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/columnNameCaseMenus';
import { menus as languageMenus } from '@/components/generator-code/generator-code-context-menu/menus/languageMenus';
import { menus as tableNameCaseMenus } from '@/components/generator-code/generator-code-context-menu/menus/tableNameCaseMenus';
import Icon from '@/components/primitives/icon/Icon';
import { menus as bracketMenus } from '@/components/schema-sql/schema-sql-context-menu/menus/bracketMenus';
import { START_X, START_Y } from '@/constants/layout';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { drawStartRelationshipAction$ } from '@/engine/modules/editor/generator.actions';
import { addMemoAction$ } from '@/engine/modules/memo/generator.actions';
import {
  changeBracketTypeAction,
  changeCanvasTypeAction,
  changeColumnNameCaseAction,
  changeDatabaseAction,
  changeLanguageAction,
  changeTableNameCaseAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction$,
  selectTableAction$,
} from '@/engine/modules/table/generator.actions';
import { getAbsoluteZoomPoint } from '@/utils/dragSelect';
import { exportJSON, exportSchemaSQL } from '@/utils/file/exportFile';
import { importJSON, importSchemaSQL } from '@/utils/file/importFile';
import { createSchemaSQL } from '@/utils/schema-sql';
import { orderByNameASC } from '@/utils/schema-sql/utils';

export type Action = {
  icon?: DOMTemplateLiterals | null;
  name: string;
  keywords?: string;
  shortcut?: string;
  filter?: (app: AppContext) => boolean;
  perform?: (app: AppContext) => void;
  next?: Action[];
};

export function searchActions(actions: Action[], keyword: string): Action[] {
  const fuse = new Fues(actions, {
    keys: ['name', 'keywords'],
  });
  return fuse.search(keyword).map(result => result.item);
}

export function createScopeActions(app: AppContext): Action[] {
  const { store, keyBindingMap } = app;
  const { settings } = store.state;

  return [
    ...allScopeActions,
    {
      icon: html`<${Icon} prefix="mdi" name="database" size=${16} />`,
      name: 'Database',
      next: databaseMenus.map<Action>(menu => ({
        icon:
          menu.value === settings.database
            ? html`<${Icon} name="check" size=${16} />`
            : null,
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
          store.state.settings.canvasType === CanvasType.schemaSQL
        );
      },
    },
    {
      icon: html`<${Icon} name="file-import" size=${16} />`,
      name: 'Import',
      next: [
        {
          icon: html`<${Icon} prefix="mdi" name="code-json" size=${16} />`,
          name: 'json',
          perform: app => {
            importJSON(app);
          },
        },
        {
          icon: html`<${Icon}
            prefix="mdi"
            name="database-import"
            size=${16}
          />`,
          name: 'Schema SQL',
          perform: app => {
            importSchemaSQL(app);
          },
        },
      ],
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    {
      icon: html`<${Icon} name="file-export" size=${16} />`,
      name: 'Export',
      next: [
        {
          icon: html`<${Icon} prefix="mdi" name="code-json" size=${16} />`,
          name: 'json',
          perform: ({ store }) => {
            exportJSON(toJson(store.state), store.state.settings.databaseName);
          },
        },
        {
          icon: html`<${Icon}
            prefix="mdi"
            name="database-export"
            size=${16}
          />`,
          name: 'Schema SQL',
          perform: ({ store }) => {
            exportSchemaSQL(
              createSchemaSQL(store.state),
              store.state.settings.databaseName
            );
          },
        },
      ],
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    {
      icon: html`<${Icon} name="table" size=${16} />`,
      name: 'New Table',
      shortcut: keyBindingMap.addTable[0]?.shortcut,
      perform: ({ store }) => {
        store.dispatch(addTableAction$());
      },
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    {
      icon: html`<${Icon} name="note-sticky" size=${16} />`,
      name: 'New Memo',
      shortcut: keyBindingMap.addMemo[0]?.shortcut,
      perform: ({ store }) => {
        store.dispatch(addMemoAction$());
      },
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    ...drawRelationshipMenus.map<Action>(menu => ({
      icon: html`<${Icon} prefix="base64" name=${menu.iconName} size=${16} />`,
      name: menu.name,
      keywords: 'Relationship',
      shortcut: keyBindingMap[menu.keyBindingName][0]?.shortcut,
      perform: ({ store }) => {
        store.dispatch(drawStartRelationshipAction$(menu.relationshipType));
      },
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    })),
    {
      icon: html`<${Icon} prefix="mdi" name="atom" size=${16} />`,
      name: 'Automatic Table Placement',
      perform: ({ store }) => {
        store.dispatch(
          changeOpenMapAction({ [Open.automaticTablePlacement]: true })
        );
      },
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.ERD;
      },
    },
    {
      icon: html`<${Icon} prefix="mdi" name="code-brackets" size=${16} />`,
      name: 'Bracket',
      next: bracketMenus.map<Action>(menu => ({
        icon:
          menu.value === settings.bracketType
            ? html`<${Icon} name="check" size=${16} />`
            : null,
        name: menu.name,
        perform: ({ store }) => {
          store.dispatch(
            changeBracketTypeAction({
              value: menu.value,
            })
          );
        },
      })),
      filter: ({ store }) => {
        return store.state.settings.canvasType === CanvasType.schemaSQL;
      },
    },
    {
      icon: html`<${Icon} name="code" size=${16} />`,
      name: 'Language',
      next: languageMenus.map<Action>(menu => ({
        icon:
          menu.value === settings.language
            ? html`<${Icon} name="check" size=${16} />`
            : null,
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
      icon: html`
        <${Icon} prefix="mdi" name="format-letter-case" size=${16} />
      `,
      name: 'Table Name Case',
      next: tableNameCaseMenus.map<Action>(menu => ({
        icon:
          menu.value === settings.tableNameCase
            ? html`<${Icon} name="check" size=${16} />`
            : null,
        name: menu.name,
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
      icon: html`
        <${Icon} prefix="mdi" name="format-letter-case" size=${16} />
      `,
      name: 'Column Name Case',
      next: columnNameCaseMenus.map<Action>(menu => ({
        icon:
          menu.value === settings.columnNameCase
            ? html`<${Icon} name="check" size=${16} />`
            : null,
        name: menu.name,
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
    ...createTableActions(app),
  ];
}

function createTableActions({ store }: AppContext): Action[] {
  const {
    settings,
    doc: { tableIds },
    collections,
  } = store.state;
  if (settings.canvasType !== CanvasType.ERD) return [];

  return query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC)
    .map<Action>(table => ({
      name: isEmpty(table.name.trim()) ? 'unnamed' : table.name,
      keywords: 'Table',
      perform: ({ store }) => {
        const {
          settings: { width, height, zoomLevel },
        } = store.state;
        const { x, y } = getAbsoluteZoomPoint(
          { x: table.ui.x - START_X, y: table.ui.y - START_Y },
          width,
          height,
          zoomLevel
        );
        store.dispatch(
          scrollToAction({
            scrollLeft: x * -1,
            scrollTop: y * -1,
          }),
          selectTableAction$(table.id, false)
        );
      },
    }));
}

export const allScopeActions: Action[] = [
  {
    name: 'Tab',
    next: [
      {
        icon: html`<${Icon} name="diagram-project" size=${16} />`,
        name: 'Entity Relationship Diagram',
        perform: ({ store }) => {
          store.dispatch(changeCanvasTypeAction({ value: CanvasType.ERD }));
        },
        filter: ({ store }) => {
          return store.state.settings.canvasType !== CanvasType.ERD;
        },
      },
      {
        icon: html`<${Icon}
          prefix="mdi"
          name="chart-scatter-plot"
          size=${16}
        />`,
        name: 'Visualization',
        perform: ({ store }) => {
          store.dispatch(
            changeCanvasTypeAction({ value: CanvasType.visualization })
          );
        },
        filter: ({ store }) => {
          return store.state.settings.canvasType !== CanvasType.visualization;
        },
      },
      {
        icon: html`<${Icon} prefix="mdi" name="database-export" size=${16} />`,
        name: 'Schema SQL',
        perform: ({ store }) => {
          store.dispatch(
            changeCanvasTypeAction({ value: CanvasType.schemaSQL })
          );
        },
        filter: ({ store }) => {
          return store.state.settings.canvasType !== CanvasType.schemaSQL;
        },
      },
      {
        icon: html`<${Icon} name="file-code" size=${16} />`,
        name: 'Generator Code',
        perform: ({ store }) => {
          store.dispatch(
            changeCanvasTypeAction({ value: CanvasType.generatorCode })
          );
        },
        filter: ({ store }) => {
          return store.state.settings.canvasType !== CanvasType.generatorCode;
        },
      },
      {
        icon: html`<${Icon} name="gear" size=${16} />`,
        name: 'Settings',
        perform: ({ store }) => {
          store.dispatch(
            changeCanvasTypeAction({ value: CanvasType.settings })
          );
        },
        filter: ({ store }) => {
          return store.state.settings.canvasType !== CanvasType.settings;
        },
      },
    ],
  },
];

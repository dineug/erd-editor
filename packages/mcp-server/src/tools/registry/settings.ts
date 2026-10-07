import {
  type ActionType,
  Database,
  DDLScriptPosition,
  settingsActions,
} from '@dineug/erd-editor/peer.js';
import type { AnyAction } from '@dineug/r-html';

import type { ActionTool, ToolArgKind } from '@/tools/registry';

const ATOM_REASON =
  'The settings module has no generator for this setting: changeZoomLevelAction$ and streamZoomLevelAction$ only zoom the canvas, and changeLockSettingsAction$ locks and unlocks settings, the database and its name not among them. The settings panel and menus dispatch this atom themselves.';

const UNDOABLE_REASON =
  'settings/history.ts makes no undo entry for the database or its name, so the engine keeps none for this setting.';

const DDL_SCRIPT_ATOM_REASON =
  'The settings module has no generator for the scripts: the Schema SQL panel dispatches changeDDLScriptAction itself, one action per edit.';

/** The longest script a call takes, so one stays well inside a read. */
export const MAX_DDL_SCRIPT_CHARS = 10_000;

const count = (value: number) => value.toLocaleString('en-US');

/**
 * A setting that takes one value, as its atom's payload does, and that the
 * engine applies but keeps no undo entry for.
 */
const valueTool = (
  name: string,
  actionType: ActionType,
  field: string,
  kind: ToolArgKind,
  creator: (payload: { value: any }) => AnyAction
): ActionTool => ({
  name,
  kind: 'atom',
  atomReason: ATOM_REASON,
  actionTypes: [actionType],
  undoable: false,
  undoableReason: UNDOABLE_REASON,
  stream: false,
  expectedBatches: 1,
  expectedHistory: 0,
  snapshotPaths: [`settings.${field}`],
  args: [{ name: 'value', kind, required: true }],
  toActions: ({ value }) => [creator({ value })],
});

/**
 * The settings of the schema itself and its Schema SQL scripts. The others are
 * the user's screen and editing habits, which an agent reads and never sets.
 */
export const settingsTools: readonly ActionTool[] = [
  valueTool(
    'erd_set_database_name',
    'settings.changeDatabaseName',
    'databaseName',
    { type: 'string' },
    settingsActions.changeDatabaseNameAction
  ),
  valueTool(
    'erd_set_database',
    'settings.changeDatabase',
    'database',
    { type: 'enum', values: Database },
    settingsActions.changeDatabaseAction
  ),
  {
    name: 'erd_set_ddl_script',
    kind: 'atom',
    atomReason: DDL_SCRIPT_ATOM_REASON,
    actionTypes: ['settings.changeDDLScript'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['settings.ddlScripts'],
    args: [
      {
        name: 'position',
        kind: { type: 'enum', values: DDLScriptPosition },
        required: true,
      },
      { name: 'sql', kind: { type: 'string' }, required: true },
    ],
    refine: ({ sql }) =>
      sql.length > MAX_DDL_SCRIPT_CHARS
        ? `sql is ${count(sql.length)} characters, over the ${count(MAX_DDL_SCRIPT_CHARS)} a script takes`
        : undefined,
    toActions: ({ position, sql }) => [
      settingsActions.changeDDLScriptAction({ position, value: sql }),
    ],
  },
];

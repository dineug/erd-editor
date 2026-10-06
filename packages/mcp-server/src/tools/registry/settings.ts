import {
  type ActionType,
  Database,
  settingsActions,
} from '@dineug/erd-editor/peer.js';
import type { AnyAction } from '@dineug/r-html';

import type { ActionTool, ToolArgKind } from '@/tools/registry';

const ATOM_REASON =
  'The settings module has no generator for this setting: changeZoomLevelAction$ and streamZoomLevelAction$ only zoom the canvas, and changeLockSettingsAction$ locks and unlocks settings, the database and its name not among them. The settings panel and menus dispatch this atom themselves.';

const UNDOABLE_REASON =
  'settings/history.ts makes undo entries only for changeShow and the viewport, so the engine keeps none for this setting.';

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
 * The settings of the schema itself. The others are the user's screen and
 * editing habits, which an agent reads in a snapshot and never sets.
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
];

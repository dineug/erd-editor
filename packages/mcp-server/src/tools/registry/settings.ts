import {
  type ActionType,
  bHas,
  BracketType,
  COLUMN_MIN_WIDTH,
  ColumnType,
  Database,
  type GeneratorAction,
  Language,
  NameCase,
  SaveSettingType,
  settingsActions,
  Show,
} from '@dineug/erd-editor/peer.js';
import type { AnyAction } from '@dineug/r-html';

import type {
  ActionTool,
  ToolArg,
  ToolArgKind,
  ToolArgValues,
} from '@/tools/registry';

const MAX_WIDTH_COMMENT = 200;

const ATOM_REASON =
  'The settings module has no generator for this setting: changeZoomLevelAction$ and streamZoomLevelAction$ only zoom the canvas. The settings panel and menus dispatch this atom themselves.';

const UNDOABLE_REASON =
  'settings/history.ts makes undo entries only for changeShow and the viewport, so the engine keeps none for this setting.';

const enumKind = (
  values: Readonly<Record<string, string | number>>
): ToolArgKind => ({ type: 'enum', values });

const arg = (name: string, kind: ToolArgKind): ToolArg => ({
  name,
  kind,
  required: true,
});

type SettingTool = {
  name: string;
  actionType: ActionType;
  field: string;
  args: ToolArg[];
  refine?: ActionTool['refine'];
  toAction: (values: ToolArgValues) => AnyAction;
};

/** One setting, which the engine applies but keeps no undo entry for. */
const settingTool = ({
  name,
  actionType,
  field,
  args,
  refine,
  toAction,
}: SettingTool): ActionTool => ({
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
  args,
  refine,
  toActions: values => [toAction(values)],
});

/** A setting that takes one value, as its atom's payload does. */
const valueTool = (
  name: string,
  actionType: ActionType,
  field: string,
  kind: ToolArgKind,
  creator: (payload: { value: any }) => AnyAction
): ActionTool =>
  settingTool({
    name,
    actionType,
    field,
    args: [arg('value', kind)],
    toAction: ({ value }) => creator({ value }),
  });

/**
 * Sets a shown part outright and yields nothing when it already holds: its
 * undo entry stores the negation of the value sent, so a repeated set would
 * leave an undo that hides or shows a part never changed.
 */
const setShowAction$ = (show: number, value: boolean): GeneratorAction =>
  function* ({ settings }) {
    if (bHas(settings.show, show) === value) return;

    yield settingsActions.changeShowAction({ show, value });
  };

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
    enumKind(Database),
    settingsActions.changeDatabaseAction
  ),
  valueTool(
    'erd_set_language',
    'settings.changeLanguage',
    'language',
    enumKind(Language),
    settingsActions.changeLanguageAction
  ),
  valueTool(
    'erd_set_table_name_case',
    'settings.changeTableNameCase',
    'tableNameCase',
    enumKind(NameCase),
    settingsActions.changeTableNameCaseAction
  ),
  valueTool(
    'erd_set_column_name_case',
    'settings.changeColumnNameCase',
    'columnNameCase',
    enumKind(NameCase),
    settingsActions.changeColumnNameCaseAction
  ),
  valueTool(
    'erd_set_bracket_type',
    'settings.changeBracketType',
    'bracketType',
    enumKind(BracketType),
    settingsActions.changeBracketTypeAction
  ),
  valueTool(
    'erd_set_relationship_data_type_sync',
    'settings.changeRelationshipDataTypeSync',
    'relationshipDataTypeSync',
    { type: 'boolean' },
    settingsActions.changeRelationshipDataTypeSyncAction
  ),
  valueTool(
    'erd_set_relationship_optimization',
    'settings.changeRelationshipOptimization',
    'relationshipOptimization',
    { type: 'boolean' },
    settingsActions.changeRelationshipOptimizationAction
  ),
  settingTool({
    name: 'erd_set_column_order',
    actionType: 'settings.changeColumnOrder',
    field: 'columnOrder',
    args: [
      arg('columnType', enumKind(ColumnType)),
      arg('targetColumnType', enumKind(ColumnType)),
    ],
    refine: ({ columnType, targetColumnType }) =>
      columnType === targetColumnType
        ? 'targetColumnType must name a different column part than columnType'
        : undefined,
    toAction: ({ columnType, targetColumnType }) =>
      settingsActions.changeColumnOrderAction({
        value: columnType,
        target: targetColumnType,
      }),
  }),
  settingTool({
    name: 'erd_set_max_width_comment',
    actionType: 'settings.changeMaxWidthComment',
    field: 'maxWidthComment',
    args: [arg('value', { type: 'integer' })],
    refine: ({ value }) =>
      value === -1 || (COLUMN_MIN_WIDTH <= value && value <= MAX_WIDTH_COMMENT)
        ? undefined
        : `value must be -1 for no limit, or from ${COLUMN_MIN_WIDTH} to ${MAX_WIDTH_COMMENT}`,
    toAction: ({ value }) =>
      settingsActions.changeMaxWidthCommentAction({ value }),
  }),
  settingTool({
    name: 'erd_set_ignore_save_settings',
    actionType: 'settings.changeIgnoreSaveSettings',
    field: 'ignoreSaveSettings',
    args: [
      arg('saveSettingType', enumKind(SaveSettingType)),
      arg('value', { type: 'boolean' }),
    ],
    toAction: ({ saveSettingType, value }) =>
      settingsActions.changeIgnoreSaveSettingsAction({
        saveSettingType,
        value,
      }),
  }),
  {
    name: 'erd_set_show',
    kind: 'atom',
    atomReason: ATOM_REASON,
    actionTypes: ['settings.changeShow'],
    undoable: true,
    stream: false,
    // Nothing goes out, and nothing is undone, when the part already shows so.
    expectedBatches: { min: 0, max: 1 },
    expectedHistory: { min: 0, max: 1 },
    snapshotPaths: ['settings.show'],
    args: [arg('show', enumKind(Show)), arg('value', { type: 'boolean' })],
    toActions: ({ show, value }) => [setShowAction$(show, value)],
  },
];

import type { ActionType, FocusType } from '@dineug/erd-editor/peer.js';
import type { CompositionActions } from '@dineug/r-html';

import { columnTools } from '@/tools/registry/column';
import { importTools } from '@/tools/registry/import';
import { indexTools } from '@/tools/registry/indexes';
import { memoTools } from '@/tools/registry/memo';
import { relationshipTools } from '@/tools/registry/relationship';
import { settingsTools } from '@/tools/registry/settings';
import { tableTools } from '@/tools/registry/table';

/** The document entities a tool argument can name by id. */
export type ToolEntity =
  | 'table'
  | 'column'
  | 'relationship'
  | 'index'
  | 'indexColumn'
  | 'memo';

/**
 * What an argument holds. An entity id must name a live entity, one inside
 * the entity parentArg names when set, or a column of an index's table. An
 * enum is passed by name and reaches toActions as the value it maps to.
 */
export type ToolArgKind =
  | { type: 'string' }
  | { type: 'number' }
  | { type: 'integer' }
  | { type: 'boolean' }
  | { type: 'enum'; values: Readonly<Record<string, string | number>> }
  | { type: 'entityId'; entity: ToolEntity; parentArg?: string }
  | { type: 'entityIdList'; entity: 'column'; parentArg: string };

export type ToolArg = {
  readonly name: string;
  readonly kind: ToolArgKind;
  readonly required: boolean;
};

/** A count a call must produce, or the range a state dependent one falls in. */
export type ExpectedCount = number | { min: number; max: number };

/**
 * The cell a tool moves the peer's focus to before its edit, so the user sees
 * where the agent is working. Declared only by tools whose own generator
 * leaves the focus alone.
 */
export type ToolFocus = {
  kind: 'table' | 'column';
  tableArg: string;
  columnArg?: string;
  focusType: FocusType;
};

/** Arguments that passed validation, enum names already mapped to values. */
export type ToolArgValues = Readonly<Record<string, any>>;

/**
 * One editing op an agent can call: machine readable only, the prose lives in
 * tools/copy.ts. A snapshot path is a dot path whose bracketed argument picks
 * the list element with that id, as in tables[tableId].name.
 */
export type ActionTool = {
  readonly name: string;
  readonly kind: 'generator' | 'atom';
  readonly atomReason?: string;
  readonly actionTypes: readonly ActionType[];
  readonly undoable: boolean;
  readonly undoableReason?: string;
  readonly stream: boolean;
  readonly expectedBatches: ExpectedCount;
  readonly expectedHistory: ExpectedCount;
  readonly focus?: ToolFocus;
  readonly snapshotPaths: readonly string[];
  readonly args: readonly ToolArg[];
  /** A rule across arguments; the message it returns refuses the call. */
  readonly refine?: (args: ToolArgValues) => string | undefined;
  readonly toActions: (args: ToolArgValues) => CompositionActions;
};

export const actionTools: readonly ActionTool[] = Object.freeze([
  ...tableTools,
  ...columnTools,
  ...relationshipTools,
  ...indexTools,
  ...memoTools,
  ...settingsTools,
  ...importTools,
]);

export const toolByName: ReadonlyMap<string, ActionTool> = new Map(
  actionTools.map(tool => [tool.name, tool])
);

import type {
  ActionType,
  FocusType,
  RootState,
} from '@dineug/erd-editor/peer.js';
import type { CompositionActions } from '@dineug/r-html';

import { columnTools } from '@/tools/registry/column';
import { importTools } from '@/tools/registry/import';
import { indexTools } from '@/tools/registry/indexes';
import { memoTools } from '@/tools/registry/memo';
import { relationshipTools } from '@/tools/registry/relationship';
import { settingsTools } from '@/tools/registry/settings';
import { tableTools } from '@/tools/registry/table';
import { tableGroupTools } from '@/tools/registry/tableGroup';

/** The document entities a tool argument can name by id. */
export type ToolEntity =
  | 'table'
  | 'column'
  | 'relationship'
  | 'index'
  | 'indexColumn'
  | 'memo'
  | 'tableGroup';

/**
 * What an argument holds. An entity id names a live entity, inside the one
 * parentArg names (an index's table for a column), or with orNone null or '',
 * which toActions gets as ''. An enum's name reaches toActions as its value.
 */
export type ToolArgKind =
  | { type: 'string' }
  | { type: 'number' }
  | { type: 'integer' }
  | { type: 'boolean' }
  | { type: 'enum'; values: Readonly<Record<string, string | number>> }
  | {
      type: 'entityId';
      entity: ToolEntity;
      parentArg?: string;
      orNone?: boolean;
    }
  | { type: 'entityIdList'; entity: 'column'; parentArg: string }
  | { type: 'entityIdList'; entity: 'table'; parentArg?: undefined }
  | { type: 'tablePositions' };

/** One entry of a table positions argument: a live table, named once in the list. */
export type TablePosition = {
  readonly tableId: string;
  readonly x: number;
  readonly y: number;
};

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
  /** A rule across arguments and the document; the message it returns refuses the call. */
  readonly refine?: (
    args: ToolArgValues,
    state: RootState
  ) => string | undefined;
  readonly toActions: (args: ToolArgValues) => CompositionActions;
};

export const actionTools: readonly ActionTool[] = Object.freeze([
  ...tableTools,
  ...columnTools,
  ...relationshipTools,
  ...indexTools,
  ...memoTools,
  ...tableGroupTools,
  ...settingsTools,
  ...importTools,
]);

export const toolByName: ReadonlyMap<string, ActionTool> = new Map(
  actionTools.map(tool => [tool.name, tool])
);

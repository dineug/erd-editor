import type { ReadFormat } from '@dineug/erd-editor/agent.js';
import type { RevertResult } from '@dineug/erd-editor/peer.js';

import type { ToolRun } from '@/tools/run';

/** Live joins a VS Code window's editing stream; headless edits the file itself. */
export type SessionMode = 'live' | 'headless';

/**
 * Ready is joined and in step. Reconnecting follows a closed editor or a
 * dropped connection, detached a leave; the next write rejoins either way.
 */
export type SessionState = 'ready' | 'reconnecting' | 'detached';

/** What an agent should know beyond the result itself, such as a reseed. */
export type Notes = string[];

export type ToolOutcome = { run: ToolRun; notes: Notes };

export type UndoOutcome = { result: RevertResult; notes: Notes };

export type ReadOutcome = { text: string; notes: Notes };

export type SaveOutcome = { saved: boolean; notes: Notes };

/** One document, live or headless behind the same face. */
export type DocumentSession = {
  readonly path: string;
  readonly mode: SessionMode;
  readonly state: SessionState;
  runTool: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<ToolOutcome>;
  read: (format: ReadFormat, vendor?: string) => Promise<ReadOutcome>;
  save: () => Promise<SaveOutcome>;
  undo: () => Promise<UndoOutcome>;
  redo: () => Promise<UndoOutcome>;
  close: () => Promise<void>;
};

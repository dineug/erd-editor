import { type HubErrorCode } from '@dineug/erd-editor-agent-hub';

/** The server's own refusals, beside the hub's codes a session passes through unchanged. */
export const SessionErrorCode = {
  /** A window guards the path with a hub false lock: its hub is off or failed to start. */
  blocked: 'blocked',
  /** A hub took over a document this server was editing on disk. */
  hubAppeared: 'hubAppeared',
  /** A lock advertises a hub that does not answer. */
  hubUnreachable: 'hubUnreachable',
  /** The window that served a document still runs, but its lock is gone. */
  hubGone: 'hubGone',
  disconnected: 'disconnected',
  timeout: 'timeout',
  /** The file changed on disk between load and write. */
  conflict: 'conflict',
  /** The file holds something the engine would load as an empty diagram, such as conflict markers. */
  invalidDocument: 'invalidDocument',
  invalidPath: 'invalidPath',
  notSaved: 'notSaved',
} as const;
export type SessionErrorCode =
  (typeof SessionErrorCode)[keyof typeof SessionErrorCode];

export type ErrorCode = SessionErrorCode | HubErrorCode;

/** A refusal an agent can act on; the tool result carries its code and message. */
export class SessionError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'SessionError';
    this.code = code;
  }
}

export function isSessionError(
  error: unknown,
  code?: ErrorCode
): error is SessionError {
  return (
    error instanceof SessionError && (code === undefined || error.code === code)
  );
}

/** The errno code of a failed fs or net call, if it has one. */
export function errnoCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

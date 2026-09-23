import { type HubErrorCode } from '@dineug/erd-editor-agent-hub';
import { PlatformError, Schema } from 'effect';

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

type SessionErrorProps = {
  readonly code: ErrorCode;
  readonly message: string;
};

/**
 * A refusal an agent can act on; the tool result carries its code and message.
 * A hub's code passes through unchanged, so the schema takes any string.
 */
export class SessionError extends Schema.TaggedError<SessionError>()(
  'SessionError',
  { code: Schema.String, message: Schema.String }
) {
  declare readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string);
  constructor(props: SessionErrorProps, options?: Schema.MakeOptions);
  constructor(
    codeOrProps: ErrorCode | SessionErrorProps,
    messageOrOptions?: string | Schema.MakeOptions
  ) {
    super(
      typeof codeOrProps === 'string'
        ? { code: codeOrProps, message: String(messageOrOptions) }
        : codeOrProps,
      typeof messageOrOptions === 'string' ? undefined : messageOrOptions
    );
  }
}

/** Whether error is a platform failure of the given kind, such as a missing file. */
export function isPlatformReason(
  error: unknown,
  tag: PlatformError.SystemErrorTag
): error is PlatformError.PlatformError {
  return (
    error instanceof PlatformError.PlatformError && error.reason._tag === tag
  );
}

export function isSessionError(
  error: unknown,
  code?: ErrorCode
): error is SessionError {
  return (
    error instanceof SessionError && (code === undefined || error.code === code)
  );
}

/**
 * The message of anything thrown. A file system failure keeps the words of the
 * system call under it, which is what a refusal quoted before effect wrapped it.
 */
export function messageOf(error: unknown): string {
  if (
    error instanceof PlatformError.PlatformError &&
    error.reason.cause instanceof Error
  ) {
    return error.reason.cause.message;
  }
  return error instanceof Error ? error.message : String(error);
}

import { Result, Schema } from 'effect';

import { type Platform } from '@/paths';

const Paths = Schema.mutable(Schema.Array(Schema.String));

/** The fields serializeLock writes, in the order it writes them. */
export const LockRecord = Schema.Struct({
  /** The socket or named pipe to connect to; empty when hub is false. */
  pipe: Schema.String,
  workspaceFolders: Paths,
  /** Absolute paths of the documents open in an ERD editor, rewritten on every open and close. */
  documents: Paths,
  ide: Schema.String,
  version: Schema.String,
  protocolVersion: Schema.Int,
  token: Schema.String,
  /** False when the window is untrusted or the hub is turned off: no pipe, but it still guards its paths. */
  hub: Schema.Boolean,
});
export type LockRecord = typeof LockRecord.Type;

/** A lock file's text: LockRecord as JSON indented by two spaces. */
const LockJson = Schema.fromJsonString(LockRecord, { space: 2 });
const decodeLock = Schema.decodeUnknownResult(LockJson);
const encodeLock = Schema.encodeSync(LockJson);

export const LOCK_DIR_MODE = 0o700;
export const LOCK_FILE_MODE = 0o600;

/**
 * The longest socket path this package hands out, in UTF-8 bytes, under the
 * sun_path field of 104 bytes on macOS and 108 on Linux. Node binds a longer
 * path truncated instead of failing, so a path over this binds under tmpdir.
 */
export const MAX_PIPE_PATH_BYTES = 100;

const LOCK_FILE_NAME = /^([1-9]\d*)\.json$/;
const encoder = new TextEncoder();

export function lockDirPath(homeDir: string): string {
  return `${homeDir.replace(/[\\/]+$/, '')}/.erd-editor/ide`;
}

export function lockFilePath(homeDir: string, pid: number): string {
  return `${lockDirPath(homeDir)}/${pid}.json`;
}

/** A named pipe on win32, a unix socket beside the lock file elsewhere. */
export function pipePath(
  homeDir: string,
  pid: number,
  platform: Platform
): string {
  return platform === 'win32'
    ? `\\\\.\\pipe\\erd-editor-ide-${pid}`
    : `${lockDirPath(homeDir)}/${pid}.sock`;
}

/** Whether a listener can bind this path; named pipes are not bound by the socket limit. */
export function pipePathFits(pipe: string, platform: Platform): boolean {
  return (
    platform === 'win32' || encoder.encode(pipe).length <= MAX_PIPE_PATH_BYTES
  );
}

/** The pid a lock file name encodes, or null for any other file in the directory. */
export function lockFilePid(fileName: string): number | null {
  const match = LOCK_FILE_NAME.exec(fileName);
  const pid = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(pid) ? pid : null;
}

/** A lock with every field of the right type, unknown fields dropped, or null. */
export function parseLock(raw: string): LockRecord | null {
  return Result.getOrNull(decodeLock(raw));
}

/** Fixed key order and only the LockRecord fields, so equal records write equal bytes. */
export function serializeLock(record: LockRecord): string {
  return `${encodeLock(record)}\n`;
}

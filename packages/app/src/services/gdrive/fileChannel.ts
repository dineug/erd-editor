import type { DriveFile } from '@/services/gdrive/driveClient';
import type { CreateChannel } from '@/services/gdrive/types';
import { safeCallback } from '@/utils/safeCallback';

export const FILE_CHANNEL_PREFIX = '@dineug/erd-editor-app/gdrive-file';
export const FILES_CHANNEL_PREFIX = '@dineug/erd-editor-app/gdrive-files';

/** The waits between a follower's hellos; after the last one it offers to take over. */
export const HELLO_BACKOFF_MS = [500, 1000, 2000, 4000] as const;
/** How long a follower waits for the leader's status after a save-request. */
export const ACK_TIMEOUT_MS = 3000;
/** How long after an edit a follower's shared store may still hold it unsent. */
export const FOLLOWER_SEND_WINDOW_MS = 500;
/** How long a rename waits for another tab to say it has the file open, without Web Locks. */
export const RENAME_PROBE_MS = 2000;
/** How long a rename waits for the leader, which first finishes a save under way. */
export const RENAME_TIMEOUT_MS = 30_000;
/** How long a follower's flush waits for the leader to end the save it asked for. */
export const FLUSH_TIMEOUT_MS = 30_000;
/** How long a follower's Check Drive waits for the leader's answer, a download included. */
export const CHECK_TIMEOUT_MS = 30_000;

export const SAVE_STATES = [
  'saved',
  'saving',
  'failed',
  'conflict',
  'unconfirmed',
  'paused',
  'deleted',
  'readonly',
  'waiting-leader',
  'waiting-snapshot',
  'account-changed',
  'scope-missing',
] as const;

/** What the save status shows, the leader's own or a follower's view of it. */
export type SaveState = (typeof SAVE_STATES)[number];

/** The states in which a follower's edits may not have reached Drive yet. */
const FOLLOWER_UNSAVED_STATES: ReadonlySet<SaveState> = new Set<SaveState>([
  'saving',
  'failed',
  'paused',
  'waiting-leader',
  'conflict',
  'unconfirmed',
]);

export const CHECK_RESULTS = [
  'resumed',
  'conflict',
  'failed',
  'skipped',
] as const;

/** How Check Drive ended: saving again, a conflict, Drive out of reach, or nothing to check. */
export type CheckResult = (typeof CHECK_RESULTS)[number];

/** A save a leader announced before its PATCH, known by the fingerprint of what it sent. */
export type SaveAttempt = { attemptId: string; fingerprint: string };

export type SnapshotMessage = {
  type: 'snapshot';
  to: string;
  value: string;
  baseModifiedTime: string;
  baseFingerprint: string;
  name: string;
  canEdit: boolean;
  canRename: boolean;
  saveState: SaveState;
  pendingAttempt: SaveAttempt | null;
};

export type ReloadedMessage = {
  type: 'reloaded';
  value: string;
  modifiedTime: string;
  fingerprint: string;
  name: string;
  canEdit: boolean;
  canRename: boolean;
};

export type SavedMessage = {
  type: 'saved';
  attemptId: string;
  modifiedTime: string;
  fingerprint: string;
};

/** The leader's answer to a follower's Check Drive, once its check ended. */
export type CheckedMessage = {
  type: 'checked';
  requestId: string;
  result: CheckResult;
};

/** The leader's answer to a flush's save-request, once the cycle it asked for ended. */
export type FlushedMessage = {
  type: 'flushed';
  requestId: string;
  /** Whether the leader has nothing left unsaved. */
  saved: boolean;
};

export type RenamedMessage = {
  type: 'renamed';
  /** The rename-request it answers; null for the leader's own rename. */
  requestId: string | null;
  name: string;
  /** The modifiedTime before the rename and after it, for a base to follow. */
  from: string;
  to: string;
};

export type RenameRequestMessage = {
  type: 'rename-request';
  requestId: string;
  name: string;
  /** The tab that is to rename, without Web Locks: the first to claim the request. */
  to?: string;
};

type Body =
  | { type: 'actions'; actions: unknown[] }
  | { type: 'hello'; from: string }
  | SnapshotMessage
  | { type: 'status'; state: SaveState; at: number }
  | { type: 'save-request'; requestId?: string }
  | FlushedMessage
  | { type: 'check-request'; requestId?: string }
  | CheckedMessage
  | { type: 'reload-request' }
  | ({ type: 'saving' } & SaveAttempt)
  | SavedMessage
  | { type: 'failed'; attemptId: string }
  | ReloadedMessage
  | RenameRequestMessage
  | { type: 'rename-claim'; requestId: string; from: string }
  | RenamedMessage
  | { type: 'rename-failed'; requestId: string };

/** A message on a file's channel, stamped with the sender's epoch: the document load it edits. */
export type FileMessage = Body & { epoch: string | null };

export type OutgoingFileMessage = Body;

type Reader = (data: Record<string, unknown>) => Body | null;

const isString = (value: unknown): value is string => typeof value === 'string';
const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isSaveState(value: unknown): value is SaveState {
  return (SAVE_STATES as readonly unknown[]).includes(value);
}

const isCheckResult = (value: unknown): value is CheckResult =>
  (CHECK_RESULTS as readonly unknown[]).includes(value);

function readAttempt(value: unknown): SaveAttempt | null {
  return isRecord(value) &&
    isString(value.attemptId) &&
    isString(value.fingerprint)
    ? { attemptId: value.attemptId, fingerprint: value.fingerprint }
    : null;
}

/** The document fields a snapshot and a reload both carry. */
function hasDocument(data: Record<string, unknown>): boolean {
  return (
    isString(data.value) &&
    isString(data.name) &&
    isBoolean(data.canEdit) &&
    isBoolean(data.canRename)
  );
}

const readers: Record<Body['type'], Reader> = {
  actions: ({ actions }) =>
    Array.isArray(actions) ? { type: 'actions', actions } : null,
  hello: ({ from }) => (isString(from) ? { type: 'hello', from } : null),
  snapshot: data => {
    const pendingAttempt = readAttempt(data.pendingAttempt);
    return hasDocument(data) &&
      isString(data.to) &&
      isString(data.baseModifiedTime) &&
      isString(data.baseFingerprint) &&
      isSaveState(data.saveState) &&
      (data.pendingAttempt === null || pendingAttempt)
      ? {
          type: 'snapshot',
          to: data.to,
          value: data.value as string,
          baseModifiedTime: data.baseModifiedTime,
          baseFingerprint: data.baseFingerprint,
          name: data.name as string,
          canEdit: data.canEdit as boolean,
          canRename: data.canRename as boolean,
          saveState: data.saveState,
          pendingAttempt,
        }
      : null;
  },
  status: ({ state, at }) =>
    isSaveState(state) && typeof at === 'number'
      ? { type: 'status', state, at }
      : null,
  'save-request': ({ requestId }) => {
    if (requestId === undefined) return { type: 'save-request' };
    return isString(requestId) ? { type: 'save-request', requestId } : null;
  },
  flushed: ({ requestId, saved }) =>
    isString(requestId) && isBoolean(saved)
      ? { type: 'flushed', requestId, saved }
      : null,
  'check-request': ({ requestId }) => {
    if (requestId === undefined) return { type: 'check-request' };
    return isString(requestId) ? { type: 'check-request', requestId } : null;
  },
  checked: ({ requestId, result }) =>
    isString(requestId) && isCheckResult(result)
      ? { type: 'checked', requestId, result }
      : null,
  'reload-request': () => ({ type: 'reload-request' }),
  saving: data => {
    const attempt = readAttempt(data);
    return attempt && { type: 'saving', ...attempt };
  },
  saved: ({ attemptId, modifiedTime, fingerprint }) =>
    isString(attemptId) && isString(modifiedTime) && isString(fingerprint)
      ? { type: 'saved', attemptId, modifiedTime, fingerprint }
      : null,
  failed: ({ attemptId }) =>
    isString(attemptId) ? { type: 'failed', attemptId } : null,
  reloaded: data =>
    hasDocument(data) &&
    isString(data.modifiedTime) &&
    isString(data.fingerprint)
      ? {
          type: 'reloaded',
          value: data.value as string,
          modifiedTime: data.modifiedTime,
          fingerprint: data.fingerprint,
          name: data.name as string,
          canEdit: data.canEdit as boolean,
          canRename: data.canRename as boolean,
        }
      : null,
  'rename-request': ({ requestId, name, to }) => {
    if (!isString(requestId) || !isString(name)) return null;
    if (to === undefined) return { type: 'rename-request', requestId, name };
    return isString(to)
      ? { type: 'rename-request', requestId, name, to }
      : null;
  },
  'rename-claim': ({ requestId, from }) =>
    isString(requestId) && isString(from)
      ? { type: 'rename-claim', requestId, from }
      : null,
  renamed: ({ requestId, name, from, to }) =>
    (requestId === null || isString(requestId)) &&
    isString(name) &&
    isString(from) &&
    isString(to)
      ? { type: 'renamed', requestId, name, from, to }
      : null,
  'rename-failed': ({ requestId }) =>
    isString(requestId) ? { type: 'rename-failed', requestId } : null,
};

/** What another tab posted, or null for anything this build does not speak. */
export function readFileMessage(data: unknown): FileMessage | null {
  if (
    !isRecord(data) ||
    !isString(data.type) ||
    !Object.hasOwn(readers, data.type)
  ) {
    return null;
  }
  const epoch = isString(data.epoch) ? data.epoch : null;
  // A document load's messages have to say which load they belong to.
  if (
    epoch === null &&
    (data.type === 'actions' ||
      data.type === 'snapshot' ||
      data.type === 'reloaded')
  ) {
    return null;
  }
  const body = readers[data.type as Body['type']](data);
  return body && { ...body, epoch };
}

/** A file's channel for one account, beside its lock of the same name. */
export function fileChannelName(sub: string, fileId: string): string {
  return `${FILE_CHANNEL_PREFIX}/${sub}/${fileId}`;
}

export type FileChannel = {
  /** Posts with the current epoch; a closed channel posts nothing. */
  post(message: OutgoingFileMessage): void;
  subscribe(listener: (message: FileMessage) => void): () => void;
  close(): void;
};

export function openFileChannel(
  createChannel: CreateChannel,
  name: string,
  getEpoch: () => string | null
): FileChannel {
  const channel = createChannel(name);
  const listeners = new Set<(message: FileMessage) => void>();
  let closed = false;

  const onMessage = (event: MessageEvent) => {
    const message = readFileMessage(event.data);
    if (!message) return;
    for (const listener of [...listeners]) safeCallback(listener, message);
  };
  channel.addEventListener('message', onMessage);

  return {
    post(message) {
      if (closed) return;
      channel.postMessage({ ...message, epoch: getEpoch() });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      if (closed) return;
      closed = true;
      listeners.clear();
      channel.removeEventListener('message', onMessage);
      channel.close();
    },
  };
}

/**
 * Says hello now and again after each backoff step, giving up once the last
 * step passes unanswered (7.5 seconds). The returned function stops it.
 */
export function sayHello(post: () => void, onGiveUp: () => void): () => void {
  let step = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = () => {
    timer = setTimeout(() => {
      step++;
      if (step >= HELLO_BACKOFF_MS.length) {
        timer = null;
        onGiveUp();
        return;
      }
      post();
      schedule();
    }, HELLO_BACKOFF_MS[step]);
  };
  post();
  schedule();

  return () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
}

export type FollowerSaveView = {
  now: number;
  /** When this tab last saw its document change, if ever. */
  lastChangeAt: number | null;
  /** Whether no leader status has come since that change. */
  changeUnconfirmed: boolean;
  /** The save state this tab shows. */
  state: SaveState;
};

/**
 * Whether closing a follower could lose an edit: one within the shared store's
 * send window, one no leader status has followed yet, or a leader whose last
 * status says its saves are not going through.
 */
export function followerHasUnsavedChanges({
  now,
  lastChangeAt,
  changeUnconfirmed,
  state,
}: FollowerSaveView): boolean {
  if (lastChangeAt !== null && now - lastChangeAt < FOLLOWER_SEND_WINDOW_MS) {
    return true;
  }
  return changeUnconfirmed || FOLLOWER_UNSAVED_STATES.has(state);
}

/** The Drive list's news across tabs: a file renamed, created or saved elsewhere. */
export type FilesMessage =
  | { type: 'renamed'; fileId: string; name: string; modifiedTime: string }
  | { type: 'created'; file: DriveFile }
  | { type: 'saved'; fileId: string; modifiedTime: string };

function readDriveFile(value: unknown): DriveFile | null {
  if (!isRecord(value)) return null;
  const { id, name, mimeType, modifiedTime, size, trashed, parents } = value;
  const { canEdit, canRename } = value;
  return isString(id) &&
    isString(name) &&
    isString(mimeType) &&
    isString(modifiedTime) &&
    (size === null || typeof size === 'number') &&
    isBoolean(trashed) &&
    Array.isArray(parents) &&
    parents.every(isString) &&
    isBoolean(canEdit) &&
    isBoolean(canRename)
    ? {
        id,
        name,
        mimeType,
        modifiedTime,
        size,
        trashed,
        parents,
        canEdit,
        canRename,
      }
    : null;
}

export function readFilesMessage(data: unknown): FilesMessage | null {
  if (!isRecord(data)) return null;
  if (data.type === 'renamed') {
    const { fileId, name, modifiedTime } = data;
    return isString(fileId) && isString(name) && isString(modifiedTime)
      ? { type: 'renamed', fileId, name, modifiedTime }
      : null;
  }
  if (data.type === 'saved') {
    const { fileId, modifiedTime } = data;
    return isString(fileId) && isString(modifiedTime)
      ? { type: 'saved', fileId, modifiedTime }
      : null;
  }
  const file = data.type === 'created' ? readDriveFile(data.file) : null;
  return file && { type: 'created', file };
}

export type FilesChannel = {
  post(message: FilesMessage): void;
  subscribe(listener: (message: FilesMessage) => void): () => void;
  close(): void;
};

/** The account's channel for the Drive list, so every tab's sidebar follows a rename or a new file. */
export function openFilesChannel(
  createChannel: CreateChannel,
  sub: string
): FilesChannel {
  const channel = createChannel(`${FILES_CHANNEL_PREFIX}/${sub}`);
  const listeners = new Set<(message: FilesMessage) => void>();
  let closed = false;

  const onMessage = (event: MessageEvent) => {
    const message = readFilesMessage(event.data);
    if (!message) return;
    for (const listener of [...listeners]) safeCallback(listener, message);
  };
  channel.addEventListener('message', onMessage);

  return {
    post(message) {
      if (!closed) channel.postMessage(message);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      if (closed) return;
      closed = true;
      listeners.clear();
      channel.removeEventListener('message', onMessage);
      channel.close();
    },
  };
}

import { isRecord } from '@/services/gdrive/util';

/**
 * What Drive's Open with and New put in ?state=, as its UI integration sends it.
 * userId is the OpenID sub of the account Drive was using, null when absent.
 */
export type DriveState =
  | {
      action: 'open';
      fileId: string;
      ids: string[];
      resourceKeys: Record<string, string>;
      userId: string | null;
    }
  | {
      action: 'create';
      /** Null when Drive names no folder. */
      folderId: string | null;
      folderResourceKey: string | null;
      userId: string | null;
    };

export type ParsedDriveState = DriveState | 'invalid' | null;

const DRIVE_ID = /^[A-Za-z0-9_-]{1,256}$/;
const USER_ID = /^[^\s]{1,256}$/;

function isDriveId(value: unknown): value is string {
  return typeof value === 'string' && DRIVE_ID.test(value);
}

/** Undefined for a malformed value, so the whole state is refused rather than half read. */
function optional<T>(
  value: unknown,
  test: (value: unknown) => value is T
): T | null | undefined {
  if (value === undefined || value === null) return null;
  return test(value) ? value : undefined;
}

function isUserId(value: unknown): value is string {
  return typeof value === 'string' && USER_ID.test(value);
}

/**
 * A resource key takes an id's characters: one goes into a request header, so a
 * line break, comma or slash could break it or add another file's key.
 */
const isResourceKey = isDriveId;

function parseResourceKeys(value: unknown): Record<string, string> | null {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) return null;
  const keys: Record<string, string> = {};
  for (const [id, key] of Object.entries(value)) {
    if (!isDriveId(id) || !isResourceKey(key)) return null;
    keys[id] = key;
  }
  return keys;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Null without a state, invalid for one that is not what Drive sends. */
export function parseDriveState(raw: string | null): ParsedDriveState {
  if (raw === null) return null;
  const state = parseJson(raw);
  if (!isRecord(state)) return 'invalid';

  const userId = optional(state.userId, isUserId);
  if (userId === undefined) return 'invalid';

  if (state.action === 'open') {
    const ids = state.ids;
    const resourceKeys = parseResourceKeys(state.resourceKeys);
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      !ids.every(isDriveId) ||
      !resourceKeys
    ) {
      return 'invalid';
    }
    return { action: 'open', fileId: ids[0], ids, resourceKeys, userId };
  }

  if (state.action === 'create') {
    const folderId = optional(state.folderId, isDriveId);
    // Drive sends an empty folderResourceKey for a folder that has no key.
    const folderResourceKey = optional(
      state.folderResourceKey === '' ? null : state.folderResourceKey,
      isResourceKey
    );
    if (folderId === undefined || folderResourceKey === undefined) {
      return 'invalid';
    }
    return { action: 'create', folderId, folderResourceKey, userId };
  }

  return 'invalid';
}

/** Whether the signed-in account is the one Drive sent; a state without userId fits any. */
export function isStateForAccount(state: DriveState, sub: string): boolean {
  return state.userId === null || state.userId === sub;
}

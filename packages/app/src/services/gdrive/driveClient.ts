import { randomBase64Url } from '@/server/auth/base64url';
import {
  isDriveDocumentName,
  NEW_FILE_MIME_TYPE,
} from '@/services/gdrive/driveFileName';
import type { FetchLike } from '@/services/gdrive/types';
import { asRecord, sleep } from '@/services/gdrive/util';

export const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/**
 * Every Drive call names its fields: without them Drive answers kind, id, name
 * and mimeType alone, and a save without modifiedTime would make every later
 * save a conflict.
 */
export const FILE_FIELDS =
  'id,name,mimeType,modifiedTime,size,trashed,parents,capabilities(canEdit,canRename)';
export const LIST_FIELDS = `nextPageToken,files(${FILE_FIELDS})`;
export const SAVE_FIELDS = 'id,modifiedTime';
export const RENAME_FIELDS = 'id,name,modifiedTime';
export const NAME_FIELDS = 'name';
export const FOLDER_FIELDS = 'id,createdTime';
export const FOLDER_LIST_FIELDS = `nextPageToken,files(${FOLDER_FIELDS})`;

export const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
/** The name the ERD Editor folder starts with; the person may rename it. */
export const APP_FOLDER_NAME = 'ERD Editor';
/** The marker that finds the folder again, wherever it was moved and whatever it is called. */
export const APP_FOLDER_PROPERTY = 'erdEditorFolder';
export const APP_FOLDER_QUERY = `mimeType='${FOLDER_MIME_TYPE}' and appProperties has { key='${APP_FOLDER_PROPERTY}' and value='1' } and trashed=false`;

export const RETRY_LIMIT = 3;
export const RETRY_BASE_MS = 1000;
const RETRY_JITTER_MS = 250;
const LIST_PAGE_SIZE = '100';
/** Folders, shortcuts and Google's own documents: files with no content to open. */
export const GOOGLE_APPS_MIME = 'application/vnd.google-apps.';
const RATE_LIMIT_REASONS = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
]);
const SCOPE_REASONS = new Set([
  'insufficientPermissions',
  'ACCESS_TOKEN_SCOPE_INSUFFICIENT',
]);

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  /** Compared as Drive writes it: the conflict check is an exact match. */
  modifiedTime: string;
  size: number | null;
  trashed: boolean;
  parents: string[];
  canEdit: boolean;
  canRename: boolean;
};

/** A folder of the app's, as the lookup reads it: the oldest one wins. */
export type DriveFolder = { id: string; createdTime: string };

export type DriveSaveResult = { id: string; modifiedTime: string };
export type DriveRenameResult = DriveSaveResult & { name: string };

export type DriveErrorKind =
  | 'network'
  | 'server'
  | 'rate-limited'
  | 'unauthorized'
  | 'scope-missing'
  | 'forbidden'
  | 'not-found'
  | 'quota'
  | 'rejected'
  | 'invalid-response';

/** A failed Drive call. Its message names the kind and Google's reason, never a file. */
export class DriveError extends Error {
  name = 'DriveError';
  readonly kind: DriveErrorKind;
  readonly status: number;
  readonly reason: string | null;
  /** Whether running the whole cycle again may succeed. */
  readonly retryable: boolean;

  constructor(
    kind: DriveErrorKind,
    status: number,
    reason: string | null,
    retryable: boolean
  ) {
    super(`Drive request failed: ${kind}${reason ? ` (${reason})` : ''}`);
    this.kind = kind;
    this.status = status;
    this.reason = reason;
    this.retryable = retryable;
  }
}

export type DriveClientDeps = {
  /** Called without a receiver; bind it where the client is assembled. */
  fetch: FetchLike;
  getAccessToken: () => Promise<string>;
  /** The token a 401 came back for, and the one to try once more with. */
  onUnauthorized: (staleToken: string) => Promise<string>;
  /** A 403 for a token without drive.file. */
  onInsufficientScope?: () => void;
  createBoundary?: () => string;
};

export type NewDriveFile = {
  name: string;
  /** Always a folder: nothing is created loose in My Drive. */
  parentId: string;
  content: string;
};

type Method = 'GET' | 'POST' | 'PATCH';

type DriveRequest = {
  method: Method;
  url: string;
  /** The file addressed, for its resource key. */
  fileId?: string;
  headers?: Record<string, string>;
  body?: string;
};

function invalidResponse(): DriveError {
  return new DriveError('invalid-response', 200, null, false);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body = asRecord(await response.json());
    if (body) return body;
  } catch {
    // Reported below as the same invalid response.
  }
  throw invalidResponse();
}

function readString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string') throw invalidResponse();
  return value;
}

export function parseDriveFile(value: unknown): DriveFile {
  const raw = asRecord(value);
  if (!raw) throw invalidResponse();
  const capabilities = asRecord(raw.capabilities);
  const size = Number(raw.size);
  return {
    id: readString(raw, 'id'),
    name: readString(raw, 'name'),
    mimeType: readString(raw, 'mimeType'),
    modifiedTime: readString(raw, 'modifiedTime'),
    size: raw.size !== undefined && Number.isFinite(size) ? size : null,
    trashed: raw.trashed === true,
    parents: Array.isArray(raw.parents)
      ? raw.parents.filter(parent => typeof parent === 'string')
      : [],
    canEdit: capabilities?.canEdit === true,
    canRename: capabilities?.canRename === true,
  };
}

function parseDriveFolder(value: unknown): DriveFolder {
  const raw = asRecord(value);
  if (!raw) throw invalidResponse();
  return {
    id: readString(raw, 'id'),
    createdTime: readString(raw, 'createdTime'),
  };
}

/** What the list shows: one of the four extensions, and no folder, shortcut or Google Doc. */
export function isListedFile(file: DriveFile): boolean {
  return (
    !file.trashed &&
    !file.mimeType.startsWith(GOOGLE_APPS_MIME) &&
    isDriveDocumentName(file.name)
  );
}

function reasonsOf(body: Record<string, unknown> | null): string[] {
  const error = asRecord(body?.error);
  const entries = [
    ...(Array.isArray(error?.errors) ? error.errors : []),
    ...(Array.isArray(error?.details) ? error.details : []),
  ];
  return entries
    .map(entry => asRecord(entry)?.reason)
    .filter(reason => typeof reason === 'string');
}

async function toDriveError(
  response: Response,
  method: Method,
  onInsufficientScope?: () => void
): Promise<DriveError> {
  const body = await response.json().then(asRecord, () => null);
  const reasons = reasonsOf(body);
  const reason = reasons[0] ?? null;
  const { status } = response;
  // A POST that may have gone through is never sent twice: it would create a second file.
  const retryable = method !== 'POST';
  const has = (set: Set<string>) => reasons.some(entry => set.has(entry));

  if (status === 401)
    return new DriveError('unauthorized', status, reason, false);
  if (status === 404) return new DriveError('not-found', status, reason, false);
  if (status === 429 || (status === 403 && has(RATE_LIMIT_REASONS))) {
    return new DriveError('rate-limited', status, reason, retryable);
  }
  if (status === 403 && has(SCOPE_REASONS)) {
    onInsufficientScope?.();
    return new DriveError('scope-missing', status, reason, false);
  }
  if (status === 403 && reasons.includes('storageQuotaExceeded')) {
    return new DriveError('quota', status, reason, false);
  }
  if (status === 403) return new DriveError('forbidden', status, reason, false);
  if (status >= 500) return new DriveError('server', status, reason, retryable);
  return new DriveError('rejected', status, reason, false);
}

function query(params: Record<string, string>): string {
  return new URLSearchParams({
    supportsAllDrives: 'true',
    ...params,
  }).toString();
}

function fileUrl(
  base: string,
  fileId: string,
  params: Record<string, string>
): string {
  return `${base}/files/${encodeURIComponent(fileId)}?${query(params)}`;
}

function multipartBody(
  boundary: string,
  metadata: Record<string, unknown>,
  content: string
): string {
  return [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${NEW_FILE_MIME_TYPE}`,
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');
}

/**
 * Drive v3 over fetch, one request per call and no retry of its own: a 401 is
 * tried once more with a renewed token, and withRetry runs whole cycles again.
 */
export function createDriveClient(deps: DriveClientDeps) {
  const {
    fetch: send,
    getAccessToken,
    onUnauthorized,
    onInsufficientScope,
    createBoundary = () => `erd-editor-${randomBase64Url(18)}`,
  } = deps;
  const resourceKeys = new Map<string, string>();

  const attempt = async (request: DriveRequest, token: string) => {
    const headers: Record<string, string> = {
      ...request.headers,
      Authorization: `Bearer ${token}`,
    };
    const key = request.fileId && resourceKeys.get(request.fileId);
    if (key) headers['X-Goog-Drive-Resource-Keys'] = `${request.fileId}/${key}`;
    try {
      return await send(request.url, {
        method: request.method,
        headers,
        body: request.body,
      });
    } catch {
      throw new DriveError('network', 0, null, request.method !== 'POST');
    }
  };

  const call = async (request: DriveRequest): Promise<Response> => {
    const token = await getAccessToken();
    let response = await attempt(request, token);
    if (response.status === 401) {
      response = await attempt(request, await onUnauthorized(token));
    }
    if (!response.ok) {
      throw await toDriveError(response, request.method, onInsufficientScope);
    }
    return response;
  };

  const callJson = async (request: DriveRequest) =>
    readJson(await call(request));

  /** Every page of a files.list, in the order its params ask for. */
  const listAll = async <T>(
    params: Record<string, string>,
    read: (value: unknown) => T
  ): Promise<T[]> => {
    const items: T[] = [];
    let pageToken: string | null = null;
    do {
      const body = await callJson({
        method: 'GET',
        url: `${DRIVE_API}/files?${query(pageToken ? { ...params, pageToken } : params)}`,
      });
      const page = Array.isArray(body.files) ? body.files : [];
      items.push(...page.map(read));
      const next = body.nextPageToken;
      pageToken = typeof next === 'string' && next ? next : null;
    } while (pageToken);
    return items;
  };

  return {
    /** Drive's resourceKeys from ?state=, sent with every later call for those files. */
    rememberResourceKeys(keys: Record<string, string>) {
      for (const [fileId, key] of Object.entries(keys)) {
        resourceKeys.set(fileId, key);
      }
    },

    /** Every page of what drive.file shows this app, newest first, listed files only. */
    async listFiles(): Promise<DriveFile[]> {
      const files = await listAll(
        {
          q: 'trashed=false',
          orderBy: 'modifiedTime desc',
          pageSize: LIST_PAGE_SIZE,
          spaces: 'drive',
          fields: LIST_FIELDS,
        },
        parseDriveFile
      );
      return files.filter(isListedFile);
    },

    /** Every folder of the app's not in the trash, found by its marker, never by name. */
    async findAppFolders(): Promise<DriveFolder[]> {
      return await listAll(
        {
          q: APP_FOLDER_QUERY,
          pageSize: LIST_PAGE_SIZE,
          spaces: 'drive',
          fields: FOLDER_LIST_FIELDS,
        },
        parseDriveFolder
      );
    },

    /** A new ERD Editor folder in My Drive, carrying the marker; never retried. */
    async createAppFolder(): Promise<DriveFolder> {
      return parseDriveFolder(
        await callJson({
          method: 'POST',
          url: `${DRIVE_API}/files?${query({ fields: FOLDER_FIELDS })}`,
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
          body: JSON.stringify({
            name: APP_FOLDER_NAME,
            mimeType: FOLDER_MIME_TYPE,
            appProperties: { [APP_FOLDER_PROPERTY]: '1' },
          }),
        })
      );
    },

    async getFile(fileId: string): Promise<DriveFile> {
      return parseDriveFile(
        await callJson({
          method: 'GET',
          url: fileUrl(DRIVE_API, fileId, { fields: FILE_FIELDS }),
          fileId,
        })
      );
    },

    /** A folder's name for the create dialog, or any file's. */
    async getName(fileId: string): Promise<string> {
      const body = await callJson({
        method: 'GET',
        url: fileUrl(DRIVE_API, fileId, { fields: NAME_FIELDS }),
        fileId,
      });
      return readString(body, 'name');
    },

    async download(fileId: string): Promise<string> {
      const response = await call({
        method: 'GET',
        url: fileUrl(DRIVE_API, fileId, { alt: 'media' }),
        fileId,
      });
      return await response.text();
    },

    /** Replaces the content, sent as the file's own mimeType so Drive keeps it. */
    async saveContent(
      file: Pick<DriveFile, 'id' | 'mimeType'>,
      content: string
    ): Promise<DriveSaveResult> {
      const body = await callJson({
        method: 'PATCH',
        url: fileUrl(DRIVE_UPLOAD_API, file.id, {
          uploadType: 'media',
          fields: SAVE_FIELDS,
        }),
        fileId: file.id,
        headers: { 'Content-Type': file.mimeType || NEW_FILE_MIME_TYPE },
        body: content,
      });
      return {
        id: readString(body, 'id'),
        modifiedTime: readString(body, 'modifiedTime'),
      };
    },

    async rename(fileId: string, name: string): Promise<DriveRenameResult> {
      const body = await callJson({
        method: 'PATCH',
        url: fileUrl(DRIVE_API, fileId, { fields: RENAME_FIELDS }),
        fileId,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ name }),
      });
      return {
        id: readString(body, 'id'),
        name: readString(body, 'name'),
        modifiedTime: readString(body, 'modifiedTime'),
      };
    },

    /** Metadata and content in one multipart request; never retried, see toDriveError. */
    async createFile({
      name,
      parentId,
      content,
    }: NewDriveFile): Promise<DriveFile> {
      const boundary = createBoundary();
      const metadata = {
        name,
        mimeType: NEW_FILE_MIME_TYPE,
        parents: [parentId],
      };
      return parseDriveFile(
        await callJson({
          method: 'POST',
          url: `${DRIVE_UPLOAD_API}/files?${query({
            uploadType: 'multipart',
            fields: FILE_FIELDS,
          })}`,
          fileId: parentId,
          headers: {
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody(boundary, metadata, content),
        })
      );
    },
  };
}

export type DriveClient = ReturnType<typeof createDriveClient>;

export type RetryOptions = {
  sleep?: (ms: number) => Promise<void>;
  retries?: number;
  random?: () => number;
};

export function backoffDelay(attempt: number, random: () => number): number {
  return RETRY_BASE_MS * 2 ** attempt + Math.floor(random() * RETRY_JITTER_MS);
}

/**
 * Runs the whole cycle again after a network error, a 5xx or a rate limit, up
 * to three times with backoff. Never one PATCH alone: a lost response may hide
 * a save that went through, which only a fresh metadata check can tell.
 */
export async function withRetry<T>(
  cycle: () => Promise<T>,
  {
    sleep: wait = sleep,
    retries = RETRY_LIMIT,
    random = Math.random,
  }: RetryOptions = {}
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await cycle();
    } catch (error) {
      if (
        attempt >= retries ||
        !(error instanceof DriveError) ||
        !error.retryable
      ) {
        throw error;
      }
      await wait(backoffDelay(attempt, random));
    }
  }
}

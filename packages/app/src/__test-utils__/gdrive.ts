import { vi } from 'vite-plus/test';

import { GRANTED_SCOPE } from '@/__test-utils__/googleOAuth';
import { CALLBACK_MARKER } from '@/server/auth/callbackPage';
import {
  RELAY_LOGOUT_PATH,
  RELAY_TOKEN_PATH,
} from '@/services/gdrive/authMode';
import type {
  GisError,
  GisOAuth2,
  GisTokenClientConfig,
  GisTokenRequest,
  GisTokenResponse,
} from '@/services/gdrive/gis';
import type { PopupWindowLike } from '@/services/gdrive/oauthPopup';
import { USERINFO_URL } from '@/services/gdrive/tokenManager';
import type {
  ChannelLike,
  FetchLike,
  LockManagerLike,
} from '@/services/gdrive/types';

export { GRANTED_SCOPE };

/**
 * fetch as workerd and Chrome have it: a call through any receiver other than
 * undefined or globalThis throws Illegal invocation.
 */
export function receiverChecked(
  handle: (input: string, init?: RequestInit) => Promise<Response>
): FetchLike {
  return function (this: unknown, input: string, init?: RequestInit) {
    if (this !== undefined && this !== globalThis) {
      throw new TypeError('Illegal invocation');
    }
    return handle(input, init);
  };
}

export function jsonReply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function htmlReply(status = 200): Response {
  return new Response('<!doctype html><title>erd-editor</title>', {
    status,
    headers: { 'Content-Type': 'text/html' },
  });
}

type HubChannel = ChannelLike & {
  name: string;
  deliver: (data: unknown) => void;
};

/**
 * BroadcastChannels of one origin: a message reaches every other open channel
 * of its name, cloned, a task later, never the one that posted it.
 */
export function createChannelHub() {
  const open = new Set<HubChannel>();
  const posted: Array<{ name: string; message: unknown }> = [];

  const send = (name: string, message: unknown, from: HubChannel | null) => {
    posted.push({ name, message });
    for (const channel of open) {
      if (channel === from || channel.name !== name) continue;
      const data = structuredClone(message);
      setTimeout(() => channel.deliver(data), 0);
    }
  };

  return {
    posted,

    create(name: string): HubChannel {
      const listeners = new Set<(event: MessageEvent) => void>();
      const channel: HubChannel = {
        name,
        postMessage(message) {
          if (!open.has(channel)) throw new Error('InvalidStateError');
          send(name, message, channel);
        },
        addEventListener(_type, listener) {
          listeners.add(listener);
        },
        removeEventListener(_type, listener) {
          listeners.delete(listener);
        },
        close() {
          open.delete(channel);
        },
        deliver(data) {
          if (!open.has(channel)) return;
          for (const listener of [...listeners]) {
            listener(new MessageEvent('message', { data }));
          }
        },
      };
      open.add(channel);
      return channel;
    },

    /** A message from a context outside the tabs, as the callback page posts. */
    broadcast(name: string, message: unknown) {
      send(name, message, null);
    },

    openCount(name: string) {
      return [...open].filter(channel => channel.name === name).length;
    },
  };
}

export type ChannelHub = ReturnType<typeof createChannelHub>;

/** navigator.locks for exclusive requests: granted a microtask later, in order, released when the callback settles. */
export function createLockManager() {
  const held = new Set<string>();
  const waiting = new Map<string, Array<() => void>>();
  const requests: string[] = [];

  const locks: LockManagerLike & { requests: string[] } = {
    requests,
    request<T>(name: string, callback: () => Promise<T>): Promise<T> {
      requests.push(name);
      return new Promise<T>((resolve, reject) => {
        const grant = () => {
          held.add(name);
          Promise.resolve()
            .then(callback)
            .then(resolve, reject)
            .finally(() => {
              held.delete(name);
              waiting.get(name)?.shift()?.();
            });
        };
        if (!held.has(name)) return grant();
        const queue = waiting.get(name) ?? [];
        queue.push(grant);
        waiting.set(name, queue);
      });
    },
  };
  return locks;
}

type RelayReply = Response | 'network-error';

/**
 * The relay's token and logout endpoints and Google's userinfo, as one fetch.
 * A signed-in relay hands out a new access token per call, each bound to the
 * account signed in when it was issued.
 */
export function createFakeRelay() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const replies: RelayReply[] = [];
  const tokenAccounts = new Map<string, { sub: string; email: string }>();
  let issued = 0;

  const relay = {
    calls,
    signedIn: true,
    expiresIn: 3600,
    scope: GRANTED_SCOPE as string | null,
    account: { sub: 'sub-1', email: 'person@example.com' },
    /** Userinfo fails while set, as on a network error. */
    userInfoDown: false,

    /** Answers the next token calls, in order, before the default behaviour. */
    queue(...next: RelayReply[]) {
      replies.push(...next);
    },

    count(path: string): number {
      return calls.filter(call => call.url === path).length;
    },

    tokenCalls(): number {
      return relay.count(RELAY_TOKEN_PATH);
    },

    /** Every call to /api/auth/*, whatever the path. */
    relayCalls(): number {
      return calls.filter(call => call.url.startsWith('/api/auth/')).length;
    },

    /** A token as the relay would issue it now, for tests that hand one over directly. */
    issue(): string {
      const token = `access-${++issued}`;
      tokenAccounts.set(token, { ...relay.account });
      return token;
    },

    fetch: receiverChecked(async (url, init): Promise<Response> => {
      calls.push({ url, init });
      if (url === USERINFO_URL) {
        const token = new Headers(init?.headers)
          .get('Authorization')
          ?.replace(/^Bearer /, '');
        const account = token && tokenAccounts.get(token);
        if (relay.userInfoDown) throw new TypeError('fetch failed');
        return account
          ? jsonReply({ ...account, email_verified: true })
          : jsonReply({ error: 'invalid_token' }, 401);
      }
      if (url === RELAY_LOGOUT_PATH) {
        relay.signedIn = false;
        return jsonReply({ ok: true, revoked: true });
      }
      if (url !== RELAY_TOKEN_PATH) return htmlReply(404);

      const queued = replies.shift();
      if (queued === 'network-error') throw new TypeError('fetch failed');
      if (queued) return queued;
      if (!relay.signedIn) return jsonReply({ error: 'signed_out' }, 401);
      return jsonReply({
        access_token: relay.issue(),
        expires_in: relay.expiresIn,
        scope: relay.scope ?? undefined,
      });
    }),
  };
  return relay;
}

export type FakeRelay = ReturnType<typeof createFakeRelay>;

/** The GIS token client: records requests and lets the test answer them. */
export function createFakeGis() {
  const requests: GisTokenRequest[] = [];
  const revoked: string[] = [];
  let config: GisTokenClientConfig | null = null;

  const oauth2: GisOAuth2 = {
    initTokenClient(next) {
      config = next;
      return {
        requestAccessToken(overrides) {
          requests.push(overrides ?? {});
        },
      };
    },
    revoke(token, done) {
      revoked.push(token);
      done?.();
    },
  };

  return {
    oauth2,
    requests,
    revoked,
    load: vi.fn(async () => oauth2),
    config: () => config,
    respond(response: GisTokenResponse) {
      config?.callback(response);
    },
    fail(type: GisError['type']) {
      config?.error_callback?.({ type });
    },
  };
}

export type FakeGis = ReturnType<typeof createFakeGis>;

/** A popup window: about:blank, then Google (cross-origin), then a page of this origin. */
export function createFakePopup() {
  const state = {
    closed: false,
    crossOrigin: false,
    href: 'about:blank',
    readyState: 'complete' as DocumentReadyState,
    marker: false,
    closeCalls: 0,
  };
  const guard = () => {
    if (state.crossOrigin) {
      throw new DOMException('Blocked a frame', 'SecurityError');
    }
  };

  const window = {
    get closed() {
      return state.closed;
    },
    close() {
      state.closeCalls++;
      state.closed = true;
    },
    get location() {
      guard();
      return { href: state.href };
    },
    get document() {
      guard();
      return {
        readyState: state.readyState,
        querySelector: (selector: string) =>
          state.marker && selector === `meta[name="${CALLBACK_MARKER}"]`
            ? {}
            : null,
      };
    },
  } as unknown as PopupWindowLike;

  return {
    window,
    state,
    atGoogle() {
      state.crossOrigin = true;
    },
    /** A same-origin page, with the callback's marker or without it. */
    atPage(href: string, { marker = false, readyState = 'complete' } = {}) {
      state.crossOrigin = false;
      state.href = href;
      state.marker = marker;
      state.readyState = readyState as DocumentReadyState;
    },
  };
}

export type FakeDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  content: string;
  trashed: boolean;
  parents: string[];
  canEdit: boolean;
  canRename: boolean;
  resourceKey: string | null;
};

export type DriveCall = {
  method: string;
  url: URL;
  headers: Headers;
  body: string | null;
};

type FieldTree = Map<string, FieldTree | null>;

/** Drive's partial response syntax: a,b,c(d,e). */
function parseFields(fields: string): FieldTree {
  let index = 0;
  const parseList = (): FieldTree => {
    const tree: FieldTree = new Map();
    while (index < fields.length && fields[index] !== ')') {
      let name = '';
      while (index < fields.length && !',()'.includes(fields[index])) {
        name += fields[index++];
      }
      let children: FieldTree | null = null;
      if (fields[index] === '(') {
        index++;
        children = parseList();
        index++;
      }
      tree.set(name.trim(), children);
      if (fields[index] === ',') index++;
    }
    return tree;
  };
  return parseList();
}

function project(value: unknown, tree: FieldTree | null): unknown {
  if (!tree || typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) return value.map(item => project(item, tree));
  const result: Record<string, unknown> = {};
  for (const [name, children] of tree) {
    const field = (value as Record<string, unknown>)[name];
    if (field !== undefined) result[name] = project(field, children);
  }
  return result;
}

const DEFAULT_FILE_FIELDS = 'kind,id,name,mimeType';
const DEFAULT_LIST_FIELDS = `kind,incompleteSearch,nextPageToken,files(${DEFAULT_FILE_FIELDS})`;

function driveError(status: number, reason: string): Response {
  return jsonReply(
    {
      error: {
        code: status,
        message: reason,
        errors: [{ domain: 'global', reason, message: reason }],
      },
    },
    status
  );
}

function parseMultipart(contentType: string, body: string) {
  const boundary = /boundary=([^;]+)/.exec(contentType)?.[1];
  if (!boundary) return null;
  const parts = body
    .split(`--${boundary}`)
    .slice(1, -1)
    .map(part => {
      const [head, ...rest] = part.replace(/^\r\n/, '').split('\r\n\r\n');
      return {
        type: /Content-Type: ([^;\r\n]+)/i.exec(head)?.[1] ?? '',
        body: rest.join('\r\n\r\n').replace(/\r\n$/, ''),
      };
    });
  return parts.length === 2 ? parts : null;
}

/**
 * Drive v3 in memory and no more lenient: only the fields asked for, pages of
 * two, a media PATCH's Content-Type becomes the mimeType, read-only files
 * refuse writes, a resource key is required. Its fetch checks the receiver.
 */
export function createFakeDrive() {
  const files = new Map<string, FakeDriveFile>();
  const calls: DriveCall[] = [];
  const failures: Array<{
    method: string;
    reply: (() => Response) | 'network-error';
  }> = [];
  let clock = Date.UTC(2026, 8, 25, 9);
  let created = 0;

  const nextTime = () => new Date((clock += 1000)).toISOString();

  const resource = (file: FakeDriveFile) => ({
    kind: 'drive#file',
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    size: String(new TextEncoder().encode(file.content).length),
    trashed: file.trashed,
    parents: file.parents,
    capabilities: { canEdit: file.canEdit, canRename: file.canRename },
  });

  const reply = (value: unknown, fields: string | null, fallback: string) =>
    jsonReply(project(value, parseFields(fields ?? fallback)));

  const drive = {
    files,
    calls,
    tokens: new Set(['drive-token-1']),
    pageSize: 2,

    add(partial: Partial<FakeDriveFile> & { name: string }): FakeDriveFile {
      const file: FakeDriveFile = {
        id: `file-${files.size + 1}`,
        mimeType: 'application/json',
        modifiedTime: nextTime(),
        content: '{}',
        trashed: false,
        parents: ['root'],
        canEdit: true,
        canRename: true,
        resourceKey: null,
        ...partial,
      };
      files.set(file.id, file);
      return file;
    },

    /** The next request of this method fails with this status and reason. */
    failNext(method: string, status: number, reason = 'backendError') {
      failures.push({ method, reply: () => driveError(status, reason) });
    },

    failNetworkNext(method: string) {
      failures.push({ method, reply: 'network-error' });
    },

    callsTo(method: string): DriveCall[] {
      return calls.filter(call => call.method === method);
    },

    fetch: receiverChecked(async (input, init): Promise<Response> => {
      const url = new URL(input);
      const method = init?.method ?? 'GET';
      const headers = new Headers(init?.headers);
      const body = typeof init?.body === 'string' ? init.body : null;
      calls.push({ method, url, headers, body });

      const failure = failures.findIndex(entry => entry.method === method);
      if (failure !== -1) {
        const [{ reply: failed }] = failures.splice(failure, 1);
        if (failed === 'network-error') throw new TypeError('fetch failed');
        return failed();
      }

      const token = headers.get('Authorization')?.replace(/^Bearer /, '');
      if (!token || !drive.tokens.has(token))
        return driveError(401, 'authError');

      const fields = url.searchParams.get('fields');
      const path = url.pathname;

      if (method === 'GET' && path === '/drive/v3/files') {
        const listed = [...files.values()]
          .filter(
            file =>
              !(url.searchParams.get('q') ?? '').includes('trashed=false') ||
              !file.trashed
          )
          .sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime));
        const start = Number(url.searchParams.get('pageToken') ?? 0);
        const size = Math.min(
          drive.pageSize,
          Number(url.searchParams.get('pageSize') ?? 100)
        );
        const page = listed.slice(start, start + size);
        const next =
          start + size < listed.length ? String(start + size) : undefined;
        return reply(
          {
            kind: 'drive#fileList',
            incompleteSearch: false,
            nextPageToken: next,
            files: page.map(resource),
          },
          fields,
          DEFAULT_LIST_FIELDS
        );
      }

      if (method === 'POST' && path === '/upload/drive/v3/files') {
        const parts =
          url.searchParams.get('uploadType') === 'multipart' && body
            ? parseMultipart(headers.get('Content-Type') ?? '', body)
            : null;
        if (!parts) return driveError(400, 'badRequest');
        const metadata = JSON.parse(parts[0].body) as {
          name: string;
          mimeType?: string;
          parents?: string[];
        };
        const file = drive.add({
          id: `created-${++created}`,
          name: metadata.name,
          mimeType: metadata.mimeType ?? parts[1].type,
          parents: metadata.parents ?? ['root'],
          content: parts[1].body,
        });
        return reply(resource(file), fields, DEFAULT_FILE_FIELDS);
      }

      const match = /^\/(upload\/)?drive\/v3\/files\/([^/]+)$/.exec(path);
      const file = match && files.get(decodeURIComponent(match[2]));
      const keys = headers.get('X-Goog-Drive-Resource-Keys') ?? '';
      if (
        !file ||
        (file.resourceKey &&
          !keys.split(',').includes(`${file.id}/${file.resourceKey}`))
      ) {
        return driveError(404, 'notFound');
      }

      if (method === 'GET' && !match[1]) {
        return url.searchParams.get('alt') === 'media'
          ? new Response(file.content, {
              headers: { 'Content-Type': file.mimeType },
            })
          : reply(resource(file), fields, DEFAULT_FILE_FIELDS);
      }
      if (method === 'PATCH' && match[1]) {
        if (url.searchParams.get('uploadType') !== 'media') {
          return driveError(400, 'badRequest');
        }
        if (!file.canEdit)
          return driveError(403, 'insufficientFilePermissions');
        file.content = body ?? '';
        file.mimeType = (headers.get('Content-Type') ?? '').split(';')[0];
        file.modifiedTime = nextTime();
        return reply(resource(file), fields, DEFAULT_FILE_FIELDS);
      }
      if (method === 'PATCH' && !match[1]) {
        if (!file.canRename)
          return driveError(403, 'insufficientFilePermissions');
        const update = JSON.parse(body ?? '{}') as { name?: string };
        if (update.name) file.name = update.name;
        file.modifiedTime = nextTime();
        return reply(resource(file), fields, DEFAULT_FILE_FIELDS);
      }
      return driveError(400, 'badRequest');
    }),
  };
  return drive;
}

export type FakeDrive = ReturnType<typeof createFakeDrive>;

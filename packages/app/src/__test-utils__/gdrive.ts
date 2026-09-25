import { vi } from 'vite-plus/test';

import { GRANTED_SCOPE } from '@/__test-utils__/googleOAuth';
import { CALLBACK_MARKER, GOOGLE_REVOKE_URL } from '@/server/auth/contract';
import {
  RELAY_LOGOUT_PATH,
  RELAY_TOKEN_PATH,
} from '@/services/gdrive/authMode';
import type {
  FileLockManagerLike,
  FileLockOptions,
} from '@/services/gdrive/fileLeader';
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
  return new Response('<!doctype html><title>ERD Editor</title>', {
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
  const muted = new Set<ChannelLike>();
  const posted: Array<{ name: string; message: unknown }> = [];

  const send = (name: string, message: unknown, from: HubChannel | null) => {
    if (from && muted.has(from)) return;
    posted.push({ name, message });
    for (const channel of open) {
      if (channel === from || channel.name !== name) continue;
      if (muted.has(channel)) continue;
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

    /** A frozen tab's channel: it hears nothing and what it posts goes nowhere. */
    mute(channel: ChannelLike) {
      muted.add(channel);
    },
  };
}

export type ChannelHub = ReturnType<typeof createChannelHub>;

function abortError(): DOMException {
  return new DOMException('The lock request was aborted.', 'AbortError');
}

type LockCallback = (lock: { name: string; mode: 'exclusive' } | null) => any;

type Holder = { steal: () => void };

/**
 * navigator.locks for exclusive requests, shared by a test's tabs: granted a
 * microtask later, in order, freed when the callback settles; ifAvailable,
 * signal, steal (the holder's promise rejects, its callback runs on) and query.
 */
export function createLockManager() {
  const held = new Map<string, Holder>();
  const waiting = new Map<string, Array<() => void>>();
  const requests: string[] = [];
  const calls: Array<{ name: string; options: FileLockOptions }> = [];

  const next = (name: string) => waiting.get(name)?.shift()?.();

  function request(
    name: string,
    optionsOrCallback: FileLockOptions | LockCallback,
    maybeCallback?: LockCallback
  ): Promise<unknown> {
    const options =
      typeof optionsOrCallback === 'function' ? {} : optionsOrCallback;
    const callback =
      typeof optionsOrCallback === 'function'
        ? optionsOrCallback
        : maybeCallback!;
    requests.push(name);
    calls.push({ name, options });

    return new Promise((resolve, reject) => {
      if (options.signal?.aborted) return reject(abortError());

      const grant = () => {
        let stolen = false;
        const holder: Holder = {
          steal: () => {
            stolen = true;
            reject(abortError());
          },
        };
        held.set(name, holder);
        Promise.resolve()
          .then(() => callback({ name, mode: 'exclusive' }))
          .then(
            value => !stolen && resolve(value),
            error => !stolen && reject(error)
          )
          .finally(() => {
            if (held.get(name) !== holder) return;
            held.delete(name);
            next(name);
          });
      };

      if (options.steal) {
        held.get(name)?.steal();
        return grant();
      }
      if (!held.has(name) && !waiting.get(name)?.length) return grant();
      if (options.ifAvailable) {
        Promise.resolve()
          .then(() => callback(null))
          .then(resolve, reject);
        return;
      }
      const queue = waiting.get(name) ?? [];
      queue.push(grant);
      waiting.set(name, queue);
      options.signal?.addEventListener('abort', () => {
        const index = queue.indexOf(grant);
        if (index === -1) return;
        queue.splice(index, 1);
        reject(abortError());
      });
    });
  }

  return {
    requests,
    calls,
    request,
    async query() {
      return {
        held: [...held.keys()].map(name => ({ name, mode: 'exclusive' })),
        pending: [...waiting].flatMap(([name, queue]) =>
          queue.map(() => ({ name, mode: 'exclusive' }))
        ),
      };
    },
    /** Whether a tab holds name, as a test sees it without awaiting a query. */
    isHeld: (name: string) => held.has(name),
    waitingFor: (name: string) => waiting.get(name)?.length ?? 0,
  } as LockManagerLike &
    FileLockManagerLike & {
      requests: string[];
      calls: Array<{ name: string; options: FileLockOptions }>;
      isHeld(name: string): boolean;
      waitingFor(name: string): number;
    };
}

export type FakeLockManager = ReturnType<typeof createLockManager>;

type RelayReply = Response | 'network-error';

/** A fetch that answers nothing until its signal aborts, as a stalled connection. */
function stalled(init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(new DOMException('Aborted', 'AbortError'))
    );
  });
}

/** The relay's router and CSRF gate: a POST with X-Requested-With, else JSON 405 or 403. */
function refusedByGate(init?: RequestInit): Response | null {
  if (init?.method !== 'POST') {
    return jsonReply({ error: 'method_not_allowed' }, 405);
  }
  if (new Headers(init.headers).get('X-Requested-With') !== 'XMLHttpRequest') {
    return jsonReply({ error: 'forbidden' }, 403);
  }
  return null;
}

/**
 * The relay's token and logout endpoints, Google's userinfo and revoke, as one
 * fetch. A signed-in relay hands out a new access token per call, each bound
 * to the account signed in when it was issued; a revoke ends the grant.
 */
export function createFakeRelay() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const replies: RelayReply[] = [];
  const logoutReplies: RelayReply[] = [];
  const holds = new Map<string, Array<Promise<void>>>();
  const revoked: string[] = [];
  const tokenAccounts = new Map<string, { sub: string; email: string }>();
  let issued = 0;
  let userInfoStalls = 0;

  const answer = async (reply: RelayReply, gate?: Promise<void>) => {
    await gate;
    if (reply === 'network-error') throw new TypeError('fetch failed');
    return reply;
  };

  const relay = {
    calls,
    revoked,
    signedIn: true,
    expiresIn: 3600,
    scope: GRANTED_SCOPE as string | null,
    account: { sub: '1001', email: 'person@example.com' },
    /** Userinfo fails while set, as on a network error. */
    userInfoDown: false,
    /** Google's revoke fails while set, as on a network error. */
    revokeDown: false,

    /** Answers the next token calls, in order, before the default behaviour. */
    queue(...next: RelayReply[]) {
      replies.push(...next);
    },

    /** Answers the next logout calls, in order, before the default behaviour. */
    queueLogout(...next: RelayReply[]) {
      logoutReplies.push(...next);
    },

    /** Delivers the next answer of path, decided at once, only once released. */
    hold(path: string = RELAY_TOKEN_PATH): () => void {
      let release: () => void = () => {};
      const queue = holds.get(path) ?? [];
      queue.push(new Promise<void>(resolve => (release = resolve)));
      holds.set(path, queue);
      return release;
    },

    /** The next userinfo calls answer nothing until their signal aborts. */
    stallUserInfo(count = 1) {
      userInfoStalls += count;
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

    /** The /api/auth/* paths called, in order. */
    relayPaths(): string[] {
      return calls
        .map(call => call.url)
        .filter(url => url.startsWith('/api/auth/'));
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
        if (userInfoStalls > 0) {
          userInfoStalls--;
          return stalled(init);
        }
        if (relay.userInfoDown) throw new TypeError('fetch failed');
        return answer(
          account
            ? jsonReply({ ...account, email_verified: true })
            : jsonReply({ error: 'invalid_token' }, 401),
          holds.get(url)?.shift()
        );
      }
      if (url === GOOGLE_REVOKE_URL) {
        if (relay.revokeDown) throw new TypeError('fetch failed');
        const token = new URLSearchParams(String(init?.body ?? '')).get(
          'token'
        );
        const form =
          init?.method === 'POST' &&
          new Headers(init.headers).get('Content-Type') ===
            'application/x-www-form-urlencoded';
        if (!form || !token) {
          return jsonReply({ error: 'invalid_request' }, 400);
        }
        revoked.push(token);
        // An access token's grant takes its refresh token, the cookie's, along.
        relay.signedIn = false;
        return jsonReply({});
      }
      if (url !== RELAY_TOKEN_PATH && url !== RELAY_LOGOUT_PATH) {
        return htmlReply(404);
      }
      const refused = refusedByGate(init);
      if (refused) return refused;

      if (url === RELAY_LOGOUT_PATH) {
        const queued = logoutReplies.shift();
        if (queued) return answer(queued);
        relay.signedIn = false;
        return jsonReply({ ok: true, revoked: true });
      }
      const queued = replies.shift();
      const reply: RelayReply =
        queued ??
        (relay.signedIn
          ? jsonReply({
              access_token: relay.issue(),
              expires_in: relay.expiresIn,
              scope: relay.scope ?? undefined,
            })
          : jsonReply({ error: 'signed_out' }, 401));
      return answer(reply, holds.get(url)?.shift());
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
      done?.({ successful: true });
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
  createdTime: string;
  /** Drive's private per-app properties; a file without any leaves them out. */
  appProperties?: Record<string, string>;
  content: string;
  /** Its own flag: Drive reports a file trashed through a parent too. */
  trashed: boolean;
  parents: string[];
  /** The shared drive it sits in; a file inside a folder there inherits it. */
  driveId?: string;
  canEdit: boolean;
  canRename: boolean;
  resourceKey: string | null;
  /** What Drive reports, when a test needs more than the content's bytes. */
  size?: number;
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

/** Whether every field asked for, nested ones included, is one the resource has. */
function isKnownSelection(tree: FieldTree, schema: FieldTree): boolean {
  return [...tree].every(([name, children]) => {
    if (!schema.has(name)) return false;
    const known = schema.get(name);
    return !children || (!!known && isKnownSelection(children, known));
  });
}

const DEFAULT_FILE_FIELDS = 'kind,id,name,mimeType';
const DEFAULT_LIST_FIELDS = `kind,incompleteSearch,nextPageToken,files(${DEFAULT_FILE_FIELDS})`;
const FILE_SCHEMA = parseFields(
  'kind,id,name,mimeType,modifiedTime,createdTime,size,trashed,parents,driveId,appProperties,capabilities(canEdit,canRename,canAddChildren)'
);
const LIST_SCHEMA: FieldTree = new Map([
  ...parseFields('kind,incompleteSearch,nextPageToken'),
  ['files', FILE_SCHEMA],
]);

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

/** Drive's canAddChildren: a folder the account may edit, and never a file. */
const canAddChildren = (file: FakeDriveFile) =>
  file.mimeType === FOLDER_MIME_TYPE && file.canEdit;

/** Reads a file with its parents: a file sits in its folders' trash and shared drive. */
type Ancestry = (file: FakeDriveFile) => FakeDriveFile[];

type FilePredicate = (file: FakeDriveFile) => boolean;

/** The only terms files.list reads here, each spelled as the client sends it. */
const QUERY_TERMS: Array<
  [RegExp, (match: string[], ancestry: Ancestry) => FilePredicate]
> = [
  [
    /^trashed\s*=\s*(true|false)$/,
    ([, value], ancestry) =>
      file =>
        ancestry(file).some(entry => entry.trashed) === (value === 'true'),
  ],
  [
    /^mimeType\s*=\s*'([^']*)'$/,
    ([, type]) =>
      file =>
        file.mimeType === type,
  ],
  [
    /^appProperties has \{ key='([^']*)' and value='([^']*)' \}$/,
    ([, key, value]) =>
      file =>
        file.appProperties?.[key] === value,
  ],
];

/** Splits q on the and between terms, not the one inside a has { ... }. */
function queryTerms(q: string): string[] {
  const terms: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < q.length; index++) {
    if (q[index] === '{') depth++;
    if (q[index] === '}') depth--;
    if (depth === 0 && q.startsWith(' and ', index)) {
      terms.push(q.slice(start, index));
      start = index + ' and '.length;
    }
  }
  return [...terms, q.slice(start)];
}

/**
 * A files.list q as a predicate: every term has to hold, and a term it cannot
 * read makes the whole query null, Drive's 400, never a match.
 */
function parseDriveQuery(q: string, ancestry: Ancestry): FilePredicate | null {
  const predicates: FilePredicate[] = [];
  for (const term of queryTerms(q)) {
    const known = QUERY_TERMS.find(([pattern]) => pattern.test(term.trim()));
    if (!known) return null;
    predicates.push(known[1](known[0].exec(term.trim())!, ancestry));
  }
  return file => predicates.every(predicate => predicate(file));
}

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

type NewFileMetadata = {
  name: string;
  mimeType?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
};

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
 * Drive v3 in memory, no more lenient: only the fields and query terms it has,
 * pages of two, trash and shared drives through parents, a media PATCH's type
 * as its mimeType, writes refused, a parent it can see and add to. Checks the receiver.
 */
export function createFakeDrive() {
  const files = new Map<string, FakeDriveFile>();
  const calls: DriveCall[] = [];
  const failures: Array<{
    method: string;
    reply: (() => Response) | 'network-error';
    when?: (url: URL) => boolean;
  }> = [];
  type Hold = {
    method: string;
    gate: Promise<void>;
    when?: (url: URL) => boolean;
  };
  const holds: Hold[] = [];
  const heldAnswers: Hold[] = [];
  const lostResponses: string[] = [];

  const gate = (list: Hold[], method: string, when?: (url: URL) => boolean) => {
    let release: () => void = () => {};
    list.push({ method, gate: new Promise<void>(r => (release = r)), when });
    return release;
  };
  const takeHold = (list: Hold[], method: string, url: URL) => {
    const index = list.findIndex(
      entry => entry.method === method && (!entry.when || entry.when(url))
    );
    return index === -1 ? null : list.splice(index, 1)[0].gate;
  };
  let clock = Date.UTC(2026, 8, 25, 9);
  let created = 0;
  let createdFolders = 0;

  const nextTime = () => new Date((clock += 1000)).toISOString();

  const ancestry: Ancestry = file => {
    const chain = [file];
    for (let index = 0; index < chain.length; index++) {
      for (const id of chain[index].parents) {
        const parent = files.get(id);
        if (parent && !chain.includes(parent)) chain.push(parent);
      }
    }
    return chain;
  };
  const driveIdOf = (file: FakeDriveFile) =>
    ancestry(file).find(entry => entry.driveId)?.driveId;
  /** Drive leaves a shared drive's files out unless the request supports them. */
  const inReach = (file: FakeDriveFile, url: URL, param: string) =>
    !driveIdOf(file) || url.searchParams.get(param) === 'true';

  const resource = (file: FakeDriveFile) => ({
    kind: 'drive#file',
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    createdTime: file.createdTime,
    size: String(file.size ?? new TextEncoder().encode(file.content).length),
    trashed: ancestry(file).some(entry => entry.trashed),
    parents: file.parents,
    driveId: driveIdOf(file),
    appProperties: file.appProperties,
    capabilities: {
      canEdit: file.canEdit,
      canRename: file.canRename,
      canAddChildren: canAddChildren(file),
    },
  });

  const isHidden = (file: FakeDriveFile, headers: Headers) =>
    !!file.resourceKey &&
    !(headers.get('X-Goog-Drive-Resource-Keys') ?? '')
      .split(',')
      .includes(`${file.id}/${file.resourceKey}`);

  /**
   * Where a create lands: My Drive without parents, else a parent it can see
   * (404) and add to (403), whose trash and shared drive the new file shares.
   */
  const placement = (
    parents: string[] | undefined,
    url: URL,
    headers: Headers
  ) => {
    if (!parents?.length) return { parents: ['root'] };
    const parent = files.get(parents[0]);
    if (
      !parent ||
      isHidden(parent, headers) ||
      !inReach(parent, url, 'supportsAllDrives')
    ) {
      return driveError(404, 'notFound');
    }
    if (!canAddChildren(parent)) {
      return driveError(403, 'insufficientFilePermissions');
    }
    return { parents };
  };

  const reply = (
    value: unknown,
    fields: string | null,
    fallback: string,
    schema = FILE_SCHEMA
  ) => {
    const tree = parseFields(fields ?? fallback);
    // Drive refuses a selection naming a field it does not have: Invalid field selection.
    if (!isKnownSelection(tree, schema)) {
      return driveError(400, 'invalidParameter');
    }
    return jsonReply(project(value, tree));
  };

  const drive = {
    files,
    calls,
    tokens: new Set(['drive-token-1']),
    pageSize: 2,
    /** Files a list leaves out for now, as Drive's search does until it catches up with a create. */
    unlisted: new Set<string>(),

    add(partial: Partial<FakeDriveFile> & { name: string }): FakeDriveFile {
      const time = nextTime();
      const file: FakeDriveFile = {
        id: `file-${files.size + 1}`,
        mimeType: 'application/json',
        modifiedTime: time,
        createdTime: time,
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

    /** The next request of this method, and of URLs when matches if given, fails so. */
    failNext(
      method: string,
      status: number,
      reason = 'backendError',
      when?: (url: URL) => boolean
    ) {
      failures.push({ method, reply: () => driveError(status, reason), when });
    },

    failNetworkNext(method: string) {
      failures.push({ method, reply: 'network-error' });
    },

    /** The next request of this method, and of URLs when matches if given, waits unprocessed until released. */
    hold(method: string, when?: (url: URL) => boolean): () => void {
      return gate(holds, method, when);
    },

    /** The next request of this method is answered at once, and the answer reaches the caller once released. */
    holdAnswer(method: string, when?: (url: URL) => boolean): () => void {
      return gate(heldAnswers, method, when);
    },

    /** The next request of this method goes through and its answer is lost, as a dropped connection. */
    loseNextResponse(method: string) {
      lostResponses.push(method);
    },

    /** A change made elsewhere, as the Drive web app or another device saves. */
    bumpRemote(fileId: string, content?: string) {
      const file = files.get(fileId)!;
      if (content !== undefined) file.content = content;
      file.modifiedTime = nextTime();
    },

    callsTo(method: string): DriveCall[] {
      return calls.filter(call => call.method === method);
    },

    fetch: receiverChecked(async (input, init): Promise<Response> => {
      const method = init?.method ?? 'GET';
      calls.push({
        method,
        url: new URL(input),
        headers: new Headers(init?.headers),
        body: typeof init?.body === 'string' ? init.body : null,
      });
      const url = new URL(input);
      const held = takeHold(holds, method, url);
      if (held) await held;
      const answerHeld = takeHold(heldAnswers, method, url);
      if (answerHeld) {
        const answer = await respond(input, init);
        await answerHeld;
        return answer;
      }
      const lost = lostResponses.indexOf(method);
      if (lost === -1) return respond(input, init);
      lostResponses.splice(lost, 1);
      await respond(input, init);
      throw new TypeError('fetch failed');
    }),
  };

  async function respond(input: string, init?: RequestInit): Promise<Response> {
    const url = new URL(input);
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? init.body : null;

    const failure = failures.findIndex(
      entry => entry.method === method && (!entry.when || entry.when(url))
    );
    if (failure !== -1) {
      const [{ reply: failed }] = failures.splice(failure, 1);
      if (failed === 'network-error') throw new TypeError('fetch failed');
      return failed();
    }

    const token = headers.get('Authorization')?.replace(/^Bearer /, '');
    if (!token || !drive.tokens.has(token)) return driveError(401, 'authError');

    const fields = url.searchParams.get('fields');
    const path = url.pathname;

    if (method === 'GET' && path === '/drive/v3/files') {
      const q = url.searchParams.get('q');
      const matches = q === null ? () => true : parseDriveQuery(q, ancestry);
      if (!matches) return driveError(400, 'invalid');
      const listed = [...files.values()]
        .filter(
          file =>
            !drive.unlisted.has(file.id) &&
            inReach(file, url, 'includeItemsFromAllDrives') &&
            matches(file)
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
        DEFAULT_LIST_FIELDS,
        LIST_SCHEMA
      );
    }

    if (method === 'POST' && path === '/upload/drive/v3/files') {
      const parts =
        url.searchParams.get('uploadType') === 'multipart' && body
          ? parseMultipart(headers.get('Content-Type') ?? '', body)
          : null;
      if (!parts) return driveError(400, 'badRequest');
      const metadata = JSON.parse(parts[0].body) as NewFileMetadata;
      const placed = placement(metadata.parents, url, headers);
      if (placed instanceof Response) return placed;
      const file = drive.add({
        id: `created-${++created}`,
        name: metadata.name,
        mimeType: metadata.mimeType ?? parts[1].type,
        appProperties: metadata.appProperties,
        content: parts[1].body,
        ...placed,
      });
      return reply(resource(file), fields, DEFAULT_FILE_FIELDS);
    }

    if (method === 'POST' && path === '/drive/v3/files') {
      // A create without content, a folder's: Drive reads its metadata from JSON alone.
      if (!headers.get('Content-Type')?.startsWith('application/json')) {
        return driveError(400, 'badRequest');
      }
      const metadata = JSON.parse(body ?? '{}') as NewFileMetadata;
      const placed = placement(metadata.parents, url, headers);
      if (placed instanceof Response) return placed;
      const file = drive.add({
        id: `created-folder-${++createdFolders}`,
        name: metadata.name,
        mimeType: metadata.mimeType ?? 'application/octet-stream',
        appProperties: metadata.appProperties,
        content: '',
        ...placed,
      });
      return reply(resource(file), fields, DEFAULT_FILE_FIELDS);
    }

    const match = /^\/(upload\/)?drive\/v3\/files\/([^/]+)$/.exec(path);
    const file = match && files.get(decodeURIComponent(match[2]));
    if (
      !file ||
      isHidden(file, headers) ||
      !inReach(file, url, 'supportsAllDrives')
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
      if (!file.canEdit) return driveError(403, 'insufficientFilePermissions');
      file.content = body ?? '';
      file.mimeType = (headers.get('Content-Type') ?? '').split(';')[0];
      file.modifiedTime = nextTime();
      return reply(resource(file), fields, DEFAULT_FILE_FIELDS);
    }
    if (method === 'PATCH' && !match[1]) {
      // Without it Drive reads no metadata from the body.
      if (!headers.get('Content-Type')?.startsWith('application/json')) {
        return driveError(400, 'badRequest');
      }
      if (!file.canRename)
        return driveError(403, 'insufficientFilePermissions');
      const update = JSON.parse(body ?? '{}') as { name?: string };
      if (update.name) file.name = update.name;
      file.modifiedTime = nextTime();
      return reply(resource(file), fields, DEFAULT_FILE_FIELDS);
    }
    return driveError(400, 'badRequest');
  }
  return drive;
}

export type FakeDrive = ReturnType<typeof createFakeDrive>;

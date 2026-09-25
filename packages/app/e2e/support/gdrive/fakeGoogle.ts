import type { BrowserContext, Page, Request, Route } from '@playwright/test';

import { OAUTH_URL } from './server';

export type FakeAccount = { sub: string; email: string };

export const ACCOUNT: FakeAccount = {
  sub: '111111111111111111111',
  email: 'ada@example.com',
};
export const OTHER_ACCOUNT: FakeAccount = {
  sub: '222222222222222222222',
  email: 'grace@example.com',
};
const ACCOUNTS = [ACCOUNT, OTHER_ACCOUNT];

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GRANTED_SCOPE = [
  DRIVE_FILE_SCOPE,
  'https://www.googleapis.com/auth/drive.install',
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');
const SCOPE_WITHOUT_DRIVE = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export const FOLDER_MIME = 'application/vnd.google-apps.folder';
/** The marker the app finds its ERD Editor folder by. */
export const APP_FOLDER_PROPERTIES = { erdEditorFolder: '1' };
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth?';

/** What the fake authorize page does with the popup: sign in, deny, close, or leave Drive unchecked. */
export type AuthorizeMode =
  | 'success'
  | 'access_denied'
  | 'close'
  | 'denyDriveFile';

export type DriveFileSeed = {
  id: string;
  name: string;
  content?: string;
  mimeType?: string;
  /** Milliseconds; files added later are newer by default. */
  modifiedTime?: number;
  /** Milliseconds; the modifiedTime it starts with by default. */
  createdTime?: number;
  /** Drive's private per-app properties, which a query can match. */
  appProperties?: Record<string, string>;
  trashed?: boolean;
  parents?: string[];
  canEdit?: boolean;
  canRename?: boolean;
  resourceKey?: string | null;
  /** Invisible under drive.file: a 404 for every request, and out of the list. */
  hidden?: boolean;
  /** The accounts drive.file lets see it, by sub; the first account's alone by default. */
  accounts?: string[];
};

type DriveFile = Required<
  Omit<DriveFileSeed, 'modifiedTime' | 'createdTime' | 'appProperties'>
> & {
  modifiedTime: string;
  createdTime: string;
  appProperties?: Record<string, string>;
};

export type DriveRequest = {
  method: string;
  url: URL;
  body: string | null;
  /** The tab that sent it, to tell the leader's PATCH from a follower's. */
  page: Page | null;
  /** When it reached the fake, in milliseconds. */
  at: number;
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

function isKnownSelection(tree: FieldTree, schema: FieldTree): boolean {
  return [...tree].every(([name, children]) => {
    if (!schema.has(name)) return false;
    const known = schema.get(name);
    return !children || (!!known && isKnownSelection(children, known));
  });
}

const DEFAULT_FILE_FIELDS = 'kind,id,name,mimeType';
const FILE_SCHEMA = parseFields(
  'kind,id,name,mimeType,modifiedTime,createdTime,size,trashed,parents,appProperties,capabilities(canEdit,canRename,canAddChildren)'
);
const LIST_SCHEMA: FieldTree = new Map([
  ...parseFields('kind,incompleteSearch,nextPageToken'),
  ['files', FILE_SCHEMA],
]);

/** Drive's canAddChildren: a folder the account may edit, and never a file. */
const canAddChildren = (file: DriveFile) =>
  file.mimeType === FOLDER_MIME && file.canEdit;

/** Drive answers two files a page here, so a list of three already reads two pages. */
const PAGE_SIZE = 2;
const DEFAULT_LIST_FIELDS = `kind,incompleteSearch,nextPageToken,files(${DEFAULT_FILE_FIELDS})`;

type FilePredicate = (file: DriveFile) => boolean;

/** The only terms files.list reads here, each spelled as the app sends it. */
const QUERY_TERMS: Array<[RegExp, (match: string[]) => FilePredicate]> = [
  [
    /^trashed\s*=\s*(true|false)$/,
    ([, value]) =>
      file =>
        file.trashed === (value === 'true'),
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

/** A files.list q as a predicate, or null for a term it cannot read: Drive's 400, never a match. */
function parseDriveQuery(q: string): FilePredicate | null {
  const predicates: FilePredicate[] = [];
  for (const term of queryTerms(q)) {
    const known = QUERY_TERMS.find(([pattern]) => pattern.test(term.trim()));
    if (!known) return null;
    predicates.push(known[1](known[0].exec(term.trim())!));
  }
  return file => predicates.every(predicate => predicate(file));
}

type NewFileMetadata = {
  name: string;
  mimeType?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
};

/** Google's scripts and APIs answer a page on another origin only with these. */
function corsHeaders(request: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': request.headers().origin ?? '*',
    'Access-Control-Allow-Headers':
      'authorization, content-type, x-goog-drive-resource-keys',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH',
  };
}

function tabOf(request: Request): Page | null {
  try {
    return request.frame().page();
  } catch {
    return null;
  }
}

function subOfToken(request: Request): string | null {
  const token = request.headers().authorization?.replace(/^Bearer /, '');
  return /^(?:access|gis)-(\d+)-\d+$/.exec(token ?? '')?.[1] ?? null;
}

/** The fake GIS script: the token client asks the route below, which counts every call. */
const GIS_SCRIPT = `(() => {
  const base = 'https://accounts.google.com/__fake/gis';
  window.google = {
    accounts: {
      oauth2: {
        initTokenClient(config) {
          return {
            requestAccessToken(overrides) {
              const params = new URLSearchParams({
                prompt: (overrides && overrides.prompt) || '',
                login_hint: (overrides && overrides.login_hint) || '',
              });
              fetch(base + '/token?' + params)
                .then(response => response.json())
                .then(body => config.callback(body));
            },
          };
        },
        revoke(token, done) {
          fetch(base + '/revoke?token=' + encodeURIComponent(token), { method: 'POST' })
            .then(
              response => done && done({ successful: response.ok }),
              () => done && done({ successful: false, error: 'network' })
            );
        },
      },
    },
  };
})();`;

/**
 * Google for a browser context: the authorize page, which registers its code
 * with the fake token server, the GIS token client, userinfo and a Drive in
 * memory that answers only the fields asked for, per account. Others abort.
 */
export async function installFakeGoogle(context: BrowserContext) {
  const files = new Map<string, DriveFile>();
  const requests: DriveRequest[] = [];
  const authorizeRequests: URL[] = [];
  const gisRequests: Array<{ prompt: string; loginHint: string }> = [];
  const gisRevoked: string[] = [];
  let clock = Date.now() - 60 * 60_000;
  let issued = 0;
  let created = 0;
  let createdFolders = 0;
  let patchGate: Promise<void> | null = null;
  let releaseGate: () => void = () => {};
  let dropPatchResponses = 0;
  const failures: Array<{ method: string; status: number; reason: string }> =
    [];

  const nextTime = () => {
    clock = Math.max(clock + 1000, Date.now());
    return new Date(clock).toISOString();
  };

  const fake = {
    files,
    requests,
    authorizeRequests,
    gisRequests,
    gisRevoked,
    authorizeMode: 'success' as AuthorizeMode,
    gisExpiresIn: 3600,

    add(seed: DriveFileSeed): DriveFile {
      const modifiedTime =
        seed.modifiedTime === undefined
          ? nextTime()
          : new Date(seed.modifiedTime).toISOString();
      const file: DriveFile = {
        content: '{}',
        mimeType: 'application/json',
        trashed: false,
        parents: ['root'],
        canEdit: true,
        // Drive lets no viewer rename, so a seed that may not edit may not rename.
        canRename: seed.canEdit ?? true,
        resourceKey: null,
        hidden: false,
        accounts: [ACCOUNT.sub],
        ...seed,
        modifiedTime,
        createdTime:
          seed.createdTime === undefined
            ? modifiedTime
            : new Date(seed.createdTime).toISOString(),
      };
      files.set(file.id, file);
      return file;
    },

    /** The ERD Editor folders, found by the marker the app looks them up by. */
    appFolders(): DriveFile[] {
      return [...files.values()].filter(
        file =>
          file.mimeType === FOLDER_MIME &&
          file.appProperties?.erdEditorFolder ===
            APP_FOLDER_PROPERTIES.erdEditorFolder
      );
    },

    /** A change from elsewhere, as the Drive web app or another device saves. */
    bumpRemote(fileId: string, content?: string) {
      const file = files.get(fileId)!;
      if (content !== undefined) file.content = content;
      file.modifiedTime = nextTime();
    },

    /** Content PATCHes wait until releasePatches. */
    holdPatches() {
      patchGate = new Promise(resolve => (releaseGate = resolve));
    },

    releasePatches() {
      patchGate = null;
      releaseGate();
    },

    /** The next content PATCH is applied and its answer lost, as a dropped connection. */
    dropNextPatchResponse() {
      dropPatchResponses++;
    },

    /** The next times Drive requests of this method fail so, before Drive looks at them. */
    failNext(
      method: string,
      status: number,
      reason = 'backendError',
      times = 1
    ) {
      for (let n = 0; n < times; n++) failures.push({ method, status, reason });
    },

    /** Drive requests made so far, by method, path and tab. */
    calls(method: string, path?: string | RegExp, page?: Page): DriveRequest[] {
      return requests.filter(
        request =>
          request.method === method &&
          (path === undefined ||
            (typeof path === 'string'
              ? request.url.pathname === path
              : path.test(request.url.pathname))) &&
          (page === undefined || request.page === page)
      );
    },

    /** The content PATCHes of a file. */
    patches(fileId: string, page?: Page) {
      return fake.calls('PATCH', `/upload/drive/v3/files/${fileId}`, page);
    },

    /** The downloads of a file. */
    downloads(fileId: string, page?: Page) {
      return fake
        .calls('GET', `/drive/v3/files/${fileId}`, page)
        .filter(request => request.url.searchParams.get('alt') === 'media');
    },
  };

  const resource = (file: DriveFile) => ({
    kind: 'drive#file',
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    createdTime: file.createdTime,
    size: String(Buffer.byteLength(file.content)),
    trashed: file.trashed,
    parents: file.parents,
    appProperties: file.appProperties,
    capabilities: {
      canEdit: file.canEdit,
      canRename: file.canRename,
      canAddChildren: canAddChildren(file),
    },
  });

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      headers: corsHeaders(route.request()),
      body: JSON.stringify(body),
    });

  const driveError = (route: Route, status: number, reason: string) =>
    json(
      route,
      {
        error: {
          code: status,
          message: reason,
          errors: [{ domain: 'global', reason, message: reason }],
        },
      },
      status
    );

  const reply = (
    route: Route,
    value: unknown,
    fields: string | null,
    fallback: string,
    schema = FILE_SCHEMA
  ) => {
    const tree = parseFields(fields ?? fallback);
    if (!isKnownSelection(tree, schema)) {
      return driveError(route, 400, 'invalidParameter');
    }
    return json(route, project(value, tree));
  };

  /** What drive.file lets this account see. */
  const visible = (file: DriveFile, sub: string) =>
    !file.hidden && file.accounts.includes(sub);

  const hasKey = (file: DriveFile, request: Request) =>
    !file.resourceKey ||
    (request.headers()['x-goog-drive-resource-keys'] ?? '')
      .split(',')
      .includes(`${file.id}/${file.resourceKey}`);

  /**
   * Where a create lands: My Drive without parents, else a folder the account
   * can see (404) and add to (403), whose trash the new file shares.
   */
  const placement = (
    parents: string[] | undefined,
    request: Request,
    sub: string
  ):
    | { parents: string[]; trashed: boolean }
    | { status: number; reason: string } => {
    if (!parents?.length) return { parents: ['root'], trashed: false };
    const parent = files.get(parents[0]);
    if (!parent || !visible(parent, sub) || !hasKey(parent, request)) {
      return { status: 404, reason: 'notFound' };
    }
    if (!canAddChildren(parent)) {
      return { status: 403, reason: 'insufficientFilePermissions' };
    }
    return { parents, trashed: parent.trashed };
  };

  async function drive(route: Route, request: Request, url: URL, sub: string) {
    const method = request.method();
    const fields = url.searchParams.get('fields');
    const path = url.pathname;
    const body = request.postData();
    const uploadType = url.searchParams.get('uploadType');

    const failure = failures.findIndex(entry => entry.method === method);
    if (failure !== -1) {
      const [{ status, reason }] = failures.splice(failure, 1);
      return driveError(route, status, reason);
    }

    if (method === 'GET' && path === '/drive/v3/files') {
      const q = url.searchParams.get('q');
      const matches = q === null ? () => true : parseDriveQuery(q);
      if (!matches) return driveError(route, 400, 'invalid');
      const listed = [...files.values()]
        .filter(file => visible(file, sub) && matches(file))
        .sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime));
      const start = Number(url.searchParams.get('pageToken') ?? 0);
      const page = listed.slice(start, start + PAGE_SIZE);
      const next =
        start + PAGE_SIZE < listed.length
          ? String(start + PAGE_SIZE)
          : undefined;
      return reply(
        route,
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
      if (uploadType !== 'multipart') {
        return driveError(route, 400, 'badRequest');
      }
      const boundary = /boundary=([^;]+)/.exec(
        request.headers()['content-type'] ?? ''
      )?.[1];
      const parts = boundary
        ? (body ?? '')
            .split(`--${boundary}`)
            .slice(1, -1)
            .map(part =>
              part
                .replace(/^\r\n/, '')
                .split('\r\n\r\n')
                .slice(1)
                .join('\r\n\r\n')
                .replace(/\r\n$/, '')
            )
        : [];
      if (parts.length !== 2) return driveError(route, 400, 'badRequest');
      const metadata = JSON.parse(parts[0]) as NewFileMetadata;
      const placed = placement(metadata.parents, request, sub);
      if ('status' in placed) {
        return driveError(route, placed.status, placed.reason);
      }
      const file = fake.add({
        id: `created-${++created}`,
        name: metadata.name,
        mimeType: metadata.mimeType ?? 'application/octet-stream',
        appProperties: metadata.appProperties,
        content: parts[1],
        accounts: [sub],
        ...placed,
      });
      return reply(route, resource(file), fields, DEFAULT_FILE_FIELDS);
    }

    if (method === 'POST' && path === '/drive/v3/files') {
      // A create without content, a folder's: Drive reads its metadata from JSON alone.
      const type = request.headers()['content-type'] ?? '';
      if (!type.startsWith('application/json')) {
        return driveError(route, 400, 'badRequest');
      }
      const metadata = JSON.parse(body ?? '{}') as NewFileMetadata;
      const placed = placement(metadata.parents, request, sub);
      if ('status' in placed) {
        return driveError(route, placed.status, placed.reason);
      }
      const file = fake.add({
        id: `created-folder-${++createdFolders}`,
        name: metadata.name,
        mimeType: metadata.mimeType ?? 'application/octet-stream',
        appProperties: metadata.appProperties,
        content: '',
        accounts: [sub],
        ...placed,
      });
      return reply(route, resource(file), fields, DEFAULT_FILE_FIELDS);
    }

    const match = /^\/(upload\/)?drive\/v3\/files\/([^/]+)$/.exec(path);
    const file = match ? files.get(decodeURIComponent(match[2])) : undefined;
    if (!match || !file || !visible(file, sub) || !hasKey(file, request)) {
      return driveError(route, 404, 'notFound');
    }

    if (method === 'GET' && !match[1]) {
      if (url.searchParams.get('alt') === 'media') {
        return route.fulfill({
          status: 200,
          contentType: file.mimeType,
          headers: corsHeaders(request),
          body: file.content,
        });
      }
      return reply(route, resource(file), fields, DEFAULT_FILE_FIELDS);
    }

    if (method === 'PATCH' && match[1]) {
      if (uploadType !== 'media') return driveError(route, 400, 'badRequest');
      if (patchGate) await patchGate;
      if (!file.canEdit) {
        return driveError(route, 403, 'insufficientFilePermissions');
      }
      file.content = body ?? '';
      file.mimeType = (request.headers()['content-type'] ?? '').split(';')[0];
      file.modifiedTime = nextTime();
      if (dropPatchResponses > 0) {
        dropPatchResponses--;
        return route.abort('connectionreset');
      }
      return reply(route, resource(file), fields, DEFAULT_FILE_FIELDS);
    }

    if (method === 'PATCH') {
      const type = request.headers()['content-type'] ?? '';
      if (!type.startsWith('application/json')) {
        return driveError(route, 400, 'badRequest');
      }
      if (!file.canRename) {
        return driveError(route, 403, 'insufficientFilePermissions');
      }
      const update = JSON.parse(body ?? '{}') as { name?: string };
      if (update.name) file.name = update.name;
      file.modifiedTime = nextTime();
      return reply(route, resource(file), fields, DEFAULT_FILE_FIELDS);
    }

    return driveError(route, 400, 'badRequest');
  }

  async function googleApis(route: Route) {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders(request) });
    }
    const url = new URL(request.url());
    requests.push({
      method: request.method(),
      url,
      body: request.postData(),
      page: tabOf(request),
      at: Date.now(),
    });
    const sub = subOfToken(request);
    const account = ACCOUNTS.find(entry => entry.sub === sub);
    if (!account) return json(route, { error: 'invalid_token' }, 401);
    if (url.pathname === '/oauth2/v3/userinfo') {
      return json(route, { ...account, email_verified: true });
    }
    return drive(route, request, url, account.sub);
  }

  async function authorize(route: Route) {
    const url = new URL(route.request().url());
    authorizeRequests.push(url);
    if (fake.authorizeMode === 'close') {
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Google</title><script>window.close()</script>',
      });
    }
    const redirectUri = url.searchParams.get('redirect_uri') ?? '';
    const back = new URL(redirectUri);
    back.searchParams.set('state', url.searchParams.get('state') ?? '');
    if (fake.authorizeMode === 'access_denied') {
      back.searchParams.set('error', 'access_denied');
    } else {
      const hint = url.searchParams.get('login_hint');
      const account = ACCOUNTS.find(entry => entry.sub === hint) ?? ACCOUNT;
      const code = `code-${++issued}`;
      const scope =
        fake.authorizeMode === 'denyDriveFile'
          ? SCOPE_WITHOUT_DRIVE
          : GRANTED_SCOPE;
      await fetch(`${OAUTH_URL}/__control/code`, {
        method: 'POST',
        body: JSON.stringify({
          code,
          clientId: url.searchParams.get('client_id'),
          redirectUri,
          challenge: url.searchParams.get('code_challenge'),
          scope,
          sub: account.sub,
        }),
      });
      back.searchParams.set('code', code);
      back.searchParams.set('scope', scope);
    }
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><title>Google</title><script>location.replace(${JSON.stringify(back.toString())})</script>`,
    });
  }

  async function gis(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/revoke')) {
      gisRevoked.push(url.searchParams.get('token') ?? '');
      return json(route, {});
    }
    const loginHint = url.searchParams.get('login_hint') ?? '';
    gisRequests.push({
      prompt: url.searchParams.get('prompt') ?? '',
      loginHint,
    });
    const account = ACCOUNTS.find(entry => entry.sub === loginHint) ?? ACCOUNT;
    return json(route, {
      access_token: `gis-${account.sub}-${++issued}`,
      expires_in: fake.gisExpiresIn,
      scope: GRANTED_SCOPE,
      token_type: 'Bearer',
    });
  }

  /**
   * The relay's real start, whose 302 to Google the browser would follow past
   * every route. Its answer comes back as a page that navigates there instead,
   * with the state cookie; the marker keeps the popup from reading it as a stray.
   */
  async function start(route: Route) {
    const response = await route.fetch({ maxRedirects: 0 });
    const location = response.headers().location ?? '';
    if (response.status() !== 302 || !location.startsWith(AUTHORIZE_URL)) {
      return route.fulfill({ response });
    }
    const cookies = response
      .headersArray()
      .filter(header => header.name.toLowerCase() === 'set-cookie')
      .map(header => header.value);
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      headers: {
        'Cache-Control': 'no-store',
        ...(cookies.length ? { 'Set-Cookie': cookies.join('\n') } : {}),
      },
      body: `<!doctype html><meta name="erd-editor-auth-callback"><title>ERD Editor</title><script>location.replace(${JSON.stringify(location)})</script>`,
    });
  }

  // The last route added is asked first, so the catch-all goes in first.
  await context.route(
    /^https:\/\/([a-z0-9-]+\.)*(google|googleapis|gstatic|googleusercontent|googletagmanager)\.com\//,
    route => route.abort()
  );
  await context.route('https://www.googleapis.com/**', googleApis);
  await context.route(url => url.href.startsWith(AUTHORIZE_URL), authorize);
  await context.route('https://accounts.google.com/gsi/client', route =>
    route.fulfill({ contentType: 'text/javascript', body: GIS_SCRIPT })
  );
  await context.route('https://accounts.google.com/__fake/gis/**', gis);
  await context.route(url => url.pathname === '/api/auth/start', start);

  return fake;
}

export type FakeGoogle = Awaited<ReturnType<typeof installFakeGoogle>>;

/** The fake token server's counters. */
export async function oauthServerState(): Promise<{
  exchanges: number;
  refreshes: number;
  revokes: number;
  liveRefreshTokens: number;
}> {
  return (await fetch(`${OAUTH_URL}/__control/state`)).json();
}

export async function resetOAuthServer() {
  await fetch(`${OAUTH_URL}/__control/reset`, { method: 'POST' });
}

/** How long the access tokens the relay hands out from now on last. */
export async function setTokenLifetime(expiresIn: number) {
  await fetch(`${OAUTH_URL}/__control/config`, {
    method: 'POST',
    body: JSON.stringify({ expiresIn }),
  });
}

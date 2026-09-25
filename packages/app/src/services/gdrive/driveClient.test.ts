import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createFakeDrive,
  type FakeDrive,
  jsonReply,
  receiverChecked,
} from '@/__test-utils__/gdrive';
import {
  backoffDelay,
  createDriveClient,
  DriveError,
  parseDriveFile,
  withRetry,
} from '@/services/gdrive/driveClient';
import { TokenUnavailableError } from '@/services/gdrive/tokenManager';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
// Spelled out, not imported: a misspelled field in the client must fail here.
const FILE_FIELDS =
  'id,name,mimeType,modifiedTime,size,trashed,parents,capabilities(canEdit,canRename)';
const APP_FOLDER_QUERY =
  "mimeType='application/vnd.google-apps.folder' and appProperties has { key='erdEditorFolder' and value='1' } and trashed=false";
const MARKER = { erdEditorFolder: '1' };
const FOLDER_FIELDS =
  'id,createdTime,trashed,driveId,capabilities(canAddChildren)';

function setup(drive: FakeDrive = createFakeDrive()) {
  const tokens = { current: 'drive-token-1', renewed: 'drive-token-2' };
  const getAccessToken = vi.fn(async () => tokens.current);
  const onUnauthorized = vi.fn(async (_stale: string) => {
    tokens.current = tokens.renewed;
    return tokens.current;
  });
  const onInsufficientScope = vi.fn();
  const client = createDriveClient({
    fetch: drive.fetch,
    getAccessToken,
    onUnauthorized,
    onInsufficientScope,
    createBoundary: () => 'test-boundary',
  });
  return {
    drive,
    tokens,
    client,
    getAccessToken,
    onUnauthorized,
    onInsufficientScope,
  };
}

async function driveError(promise: Promise<unknown>): Promise<DriveError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason
  );
  if (!(error instanceof DriveError))
    throw new Error(`not a DriveError: ${error}`);
  return error;
}

describe('createDriveClient', () => {
  it('lists every page of the four extensions, newest first, leaving the rest out', async () => {
    const { drive, client } = setup();
    const names = [
      'a.erd',
      'b.vuerd',
      'notes.txt',
      'c.erd.json',
      'd.vuerd.json',
      'e.json',
    ];
    for (const name of names) drive.add({ name });
    drive.add({ name: 'folder.erd', mimeType: FOLDER_MIME });
    drive.add({
      name: 'ERD Editor',
      mimeType: FOLDER_MIME,
      appProperties: MARKER,
    });
    drive.add({
      name: 'link.erd',
      mimeType: 'application/vnd.google-apps.shortcut',
    });
    drive.add({
      name: 'doc.erd',
      mimeType: 'application/vnd.google-apps.document',
    });
    drive.add({ name: 'old.erd', trashed: true });

    const files = await client.listFiles();

    expect(files.map(file => file.name)).toEqual([
      'd.vuerd.json',
      'c.erd.json',
      'b.vuerd',
      'a.erd',
    ]);
    const lists = drive.callsTo('GET');
    expect(lists).toHaveLength(5);
    expect(lists.map(call => call.url.searchParams.get('pageToken'))).toEqual([
      null,
      '2',
      '4',
      '6',
      '8',
    ]);
    for (const { url } of lists) {
      expect(url.origin + url.pathname).toBe(
        'https://www.googleapis.com/drive/v3/files'
      );
      expect(url.searchParams.get('fields')).toBe(
        `nextPageToken,files(${FILE_FIELDS})`
      );
      expect(url.searchParams.get('q')).toBe('trashed=false');
      expect(url.searchParams.get('orderBy')).toBe('modifiedTime desc');
      expect(url.searchParams.get('supportsAllDrives')).toBe('true');
      expect(url.searchParams.get('spaces')).toBe('drive');
    }
  });

  it('reads the listed files with every field it asked for', async () => {
    const { drive, client } = setup();
    const renamable = drive.add({
      name: 'orders.erd',
      mimeType: 'application/octet-stream',
      content: '{"version":"3.0.0"}',
      parents: ['folder-1'],
      canEdit: false,
      canRename: true,
    });
    const editable = drive.add({
      name: 'sales.erd.json',
      canEdit: true,
      canRename: false,
    });

    await expect(client.listFiles()).resolves.toEqual([
      {
        id: editable.id,
        name: 'sales.erd.json',
        mimeType: 'application/json',
        modifiedTime: editable.modifiedTime,
        size: 2,
        trashed: false,
        parents: ['root'],
        canEdit: true,
        canRename: false,
      },
      {
        id: renamable.id,
        name: 'orders.erd',
        mimeType: 'application/octet-stream',
        modifiedTime: renamable.modifiedTime,
        size: 19,
        trashed: false,
        parents: ['folder-1'],
        canEdit: false,
        canRename: true,
      },
    ]);
  });

  it('reads a file in the trash as trashed', async () => {
    const { drive, client } = setup();
    const file = drive.add({ name: 'old.erd', trashed: true });

    await expect(client.getFile(file.id)).resolves.toMatchObject({
      trashed: true,
      canEdit: true,
      canRename: true,
    });
  });

  it('lists nothing from an empty Drive in one call', async () => {
    const { drive, client } = setup();
    await expect(client.listFiles()).resolves.toEqual([]);
    expect(drive.calls).toHaveLength(1);
  });

  it('reads a file with FILE_FIELDS and sends its resource key once told it', async () => {
    const { drive, client } = setup();
    const file = drive.add({ name: 'shared.erd', resourceKey: '0-key' });

    const hidden = await driveError(client.getFile(file.id));
    expect(hidden.kind).toBe('not-found');

    client.rememberResourceKeys({ [file.id]: '0-key' });
    await expect(client.getFile(file.id)).resolves.toMatchObject({
      id: file.id,
      modifiedTime: file.modifiedTime,
      canEdit: true,
    });

    const [, read] = drive.calls;
    expect(read.url.pathname).toBe(`/drive/v3/files/${file.id}`);
    expect(read.url.searchParams.get('fields')).toBe(FILE_FIELDS);
    expect(read.url.searchParams.get('supportsAllDrives')).toBe('true');
    expect(read.headers.get('X-Goog-Drive-Resource-Keys')).toBe(
      `${file.id}/0-key`
    );
    expect(read.headers.get('Authorization')).toBe('Bearer drive-token-1');
  });

  it('reads a folder name with fields=name', async () => {
    const { drive, client } = setup();
    const folder = drive.add({ name: 'Designs', mimeType: FOLDER_MIME });

    await expect(client.getName(folder.id)).resolves.toBe('Designs');
    expect(drive.calls[0].url.searchParams.get('fields')).toBe('name');
  });

  it('downloads the content with alt=media', async () => {
    const { drive, client } = setup();
    const file = drive.add({ name: 'orders.erd', content: '{"a":1}' });

    await expect(client.download(file.id)).resolves.toBe('{"a":1}');
    const [call] = drive.calls;
    expect(call.url.searchParams.get('alt')).toBe('media');
    expect(call.url.searchParams.get('fields')).toBeNull();
    expect(call.url.searchParams.get('supportsAllDrives')).toBe('true');
  });

  it('saves content as the file mimeType and gets back the modifiedTime Drive now holds', async () => {
    const { drive, client } = setup();
    const file = drive.add({
      name: 'orders.erd',
      mimeType: 'application/octet-stream',
    });

    const saved = await client.saveContent(file, '{"version":"3.0.0"}');

    const [call] = drive.calls;
    expect(call.method).toBe('PATCH');
    expect(call.url.origin + call.url.pathname).toBe(
      `https://www.googleapis.com/upload/drive/v3/files/${file.id}`
    );
    expect(call.url.searchParams.get('uploadType')).toBe('media');
    expect(call.url.searchParams.get('fields')).toBe('id,modifiedTime');
    expect(call.url.searchParams.get('supportsAllDrives')).toBe('true');
    expect(call.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(call.body).toBe('{"version":"3.0.0"}');
    expect(drive.files.get(file.id)).toMatchObject({
      content: '{"version":"3.0.0"}',
      mimeType: 'application/octet-stream',
    });
    // The next save compares against this, so it must be what Drive reports.
    expect(saved).toEqual({
      id: file.id,
      modifiedTime: (await client.getFile(file.id)).modifiedTime,
    });
  });

  it('saves a file without a mimeType as JSON', async () => {
    const { drive, client } = setup();
    const file = drive.add({ name: 'orders.erd.json' });

    await client.saveContent({ id: file.id, mimeType: '' }, '{}');

    expect(drive.calls[0].headers.get('Content-Type')).toBe('application/json');
  });

  it('renames with a metadata PATCH asking for the new modifiedTime', async () => {
    const { drive, client } = setup();
    const file = drive.add({ name: 'orders.vuerd' });
    const before = file.modifiedTime;

    const renamed = await client.rename(file.id, 'sales.vuerd');

    const [call] = drive.calls;
    expect(call.method).toBe('PATCH');
    expect(call.url.pathname).toBe(`/drive/v3/files/${file.id}`);
    expect(call.url.searchParams.get('fields')).toBe('id,name,modifiedTime');
    // Drive reads metadata from a JSON body alone; text/plain would rename nothing.
    expect(call.headers.get('Content-Type')).toBe(
      'application/json; charset=UTF-8'
    );
    expect(JSON.parse(call.body ?? '')).toEqual({ name: 'sales.vuerd' });
    expect(renamed).toEqual({
      id: file.id,
      name: 'sales.vuerd',
      modifiedTime: drive.files.get(file.id)?.modifiedTime,
    });
    expect(renamed.modifiedTime).not.toBe(before);
  });

  it('creates a file in one multipart request, in the folder Drive named', async () => {
    const { drive, client } = setup();
    const folder = drive.add({ name: 'Designs', mimeType: FOLDER_MIME });
    client.rememberResourceKeys({ [folder.id]: 'folder-key' });

    const created = await client.createFile({
      name: 'orders.erd.json',
      parentId: folder.id,
      content: '{"version":"3.0.0"}',
    });

    const [call] = drive.calls;
    expect(call.method).toBe('POST');
    expect(call.url.origin + call.url.pathname).toBe(
      'https://www.googleapis.com/upload/drive/v3/files'
    );
    expect(call.url.searchParams.get('uploadType')).toBe('multipart');
    expect(call.url.searchParams.get('fields')).toBe(FILE_FIELDS);
    expect(call.url.searchParams.get('supportsAllDrives')).toBe('true');
    expect(call.headers.get('Content-Type')).toBe(
      'multipart/related; boundary=test-boundary'
    );
    expect(call.headers.get('X-Goog-Drive-Resource-Keys')).toBe(
      `${folder.id}/folder-key`
    );
    expect(created).toMatchObject({
      name: 'orders.erd.json',
      mimeType: 'application/json',
      parents: [folder.id],
      canEdit: true,
    });
    expect(drive.files.get(created.id)?.content).toBe('{"version":"3.0.0"}');
  });

  it('names the folder in the metadata, so a create never lands loose in My Drive', async () => {
    const { drive, client } = setup();
    const folder = drive.add({ name: 'ERD Editor', mimeType: FOLDER_MIME });

    await client.createFile({
      name: 'orders.erd.json',
      parentId: folder.id,
      content: '{}',
    });

    const [metadata] = drive.calls[0].body!.split('\r\n\r\n')[1].split('\r\n');
    expect(JSON.parse(metadata)).toEqual({
      name: 'orders.erd.json',
      mimeType: 'application/json',
      parents: [folder.id],
    });
  });

  it('makes its own multipart boundary by default', async () => {
    const drive = createFakeDrive();
    const folder = drive.add({ name: 'ERD Editor', mimeType: FOLDER_MIME });
    const client = createDriveClient({
      fetch: drive.fetch,
      getAccessToken: async () => 'drive-token-1',
      onUnauthorized: async token => token,
    });

    await client.createFile({
      name: 'a.erd.json',
      parentId: folder.id,
      content: '{}',
    });

    expect(drive.calls[0].headers.get('Content-Type')).toMatch(
      /^multipart\/related; boundary=erd-editor-[A-Za-z0-9_-]{24}$/
    );
  });

  it('finds the ERD Editor folders by their marker alone, every page, with explicit fields', async () => {
    const { drive, client } = setup();
    const renamed = drive.add({
      name: 'Diagrams',
      mimeType: FOLDER_MIME,
      appProperties: MARKER,
      createdTime: '2026-09-01T00:00:00.000Z',
      parents: ['folder-9'],
    });
    const second = drive.add({
      name: 'ERD Editor',
      mimeType: FOLDER_MIME,
      appProperties: MARKER,
    });
    const third = drive.add({
      name: 'ERD Editor',
      mimeType: FOLDER_MIME,
      appProperties: MARKER,
    });
    drive.add({
      name: 'ERD Editor',
      mimeType: FOLDER_MIME,
      appProperties: MARKER,
      trashed: true,
    });
    drive.add({ name: 'ERD Editor', mimeType: FOLDER_MIME });
    drive.add({
      name: 'ERD Editor',
      mimeType: FOLDER_MIME,
      appProperties: { erdEditorFolder: '0' },
    });
    drive.add({ name: 'ERD Editor.erd', appProperties: MARKER });

    const folders = await client.findAppFolders();

    const open = { trashed: false, driveId: null, canAddChildren: true };
    expect(folders).toEqual(
      expect.arrayContaining([
        { id: renamed.id, createdTime: '2026-09-01T00:00:00.000Z', ...open },
        { id: second.id, createdTime: second.createdTime, ...open },
        { id: third.id, createdTime: third.createdTime, ...open },
      ])
    );
    expect(folders).toHaveLength(3);
    const lists = drive.callsTo('GET');
    expect(lists.map(call => call.url.searchParams.get('pageToken'))).toEqual([
      null,
      '2',
    ]);
    for (const { url } of lists) {
      expect(url.origin + url.pathname).toBe(
        'https://www.googleapis.com/drive/v3/files'
      );
      expect(url.searchParams.get('q')).toBe(APP_FOLDER_QUERY);
      expect(url.searchParams.get('fields')).toBe(
        `nextPageToken,files(${FOLDER_FIELDS})`
      );
      expect(url.searchParams.has('includeItemsFromAllDrives')).toBe(false);
      expect(url.searchParams.get('spaces')).toBe('drive');
      expect(url.searchParams.get('supportsAllDrives')).toBe('true');
    }
  });

  it('creates the ERD Editor folder in My Drive with its marker, in one JSON POST', async () => {
    const { drive, client } = setup();

    const folder = await client.createAppFolder();

    const [call] = drive.calls;
    expect(call.method).toBe('POST');
    expect(call.url.origin + call.url.pathname).toBe(
      'https://www.googleapis.com/drive/v3/files'
    );
    expect(call.url.searchParams.get('fields')).toBe(FOLDER_FIELDS);
    expect(call.url.searchParams.get('supportsAllDrives')).toBe('true');
    expect(call.url.searchParams.get('uploadType')).toBeNull();
    expect(call.headers.get('Content-Type')).toBe(
      'application/json; charset=UTF-8'
    );
    expect(JSON.parse(call.body ?? '')).toEqual({
      name: 'ERD Editor',
      mimeType: FOLDER_MIME,
      appProperties: MARKER,
    });
    const stored = drive.files.get(folder.id)!;
    expect(folder).toEqual({
      id: stored.id,
      createdTime: stored.createdTime,
      trashed: false,
      driveId: null,
      canAddChildren: true,
    });
    expect(stored).toMatchObject({
      name: 'ERD Editor',
      mimeType: FOLDER_MIME,
      parents: ['root'],
      appProperties: MARKER,
    });
    await expect(client.findAppFolders()).resolves.toEqual([folder]);
  });

  it('reads the folder again, whether it is in the trash, in a shared drive and takes new files', async () => {
    const { drive, client } = setup();
    const folder = drive.add({
      name: 'Diagrams',
      mimeType: FOLDER_MIME,
      appProperties: MARKER,
      createdTime: '2026-09-01T00:00:00.000Z',
    });

    await expect(client.getFolder(folder.id)).resolves.toEqual({
      id: folder.id,
      createdTime: '2026-09-01T00:00:00.000Z',
      trashed: false,
      driveId: null,
      canAddChildren: true,
    });
    const [call] = drive.calls;
    expect(call.url.pathname).toBe(`/drive/v3/files/${folder.id}`);
    expect(call.url.searchParams.get('fields')).toBe(FOLDER_FIELDS);
    expect(call.url.searchParams.get('supportsAllDrives')).toBe('true');

    const parent = drive.add({ name: 'Projects', mimeType: FOLDER_MIME });
    folder.parents = [parent.id];
    parent.trashed = true;
    await expect(client.getFolder(folder.id)).resolves.toMatchObject({
      trashed: true,
    });
    parent.trashed = false;
    parent.driveId = 'team-drive';
    await expect(client.getFolder(folder.id)).resolves.toMatchObject({
      trashed: false,
      driveId: 'team-drive',
    });

    folder.trashed = true;
    folder.canEdit = false;
    await expect(client.getFolder(folder.id)).resolves.toMatchObject({
      trashed: true,
      canAddChildren: false,
    });
    await expect(driveError(client.getFolder('gone'))).resolves.toMatchObject({
      kind: 'not-found',
    });
  });

  it.each([
    ['a listed folder that is no object', { files: [null] }],
    ['a listed folder without createdTime', { files: [{ id: 'x' }] }],
  ])('refuses %s as an invalid response', async (_label, body) => {
    const client = createDriveClient({
      fetch: receiverChecked(async () => jsonReply(body)),
      getAccessToken: async () => 't',
      onUnauthorized: async token => token,
    });

    await expect(driveError(client.findAppFolders())).resolves.toMatchObject({
      kind: 'invalid-response',
    });
  });

  it('never creates the folder twice: a POST is not retried', async () => {
    const { drive, client } = setup();
    drive.failNetworkNext('POST');

    await expect(
      withRetry(() => client.createAppFolder(), { sleep: async () => {} })
    ).rejects.toMatchObject({ kind: 'network', retryable: false });
    expect(drive.callsTo('POST')).toHaveLength(1);
  });

  it('renews the token once on a 401 and sends the same request again', async () => {
    const { drive, client, onUnauthorized } = setup();
    const file = drive.add({ name: 'orders.erd' });
    drive.tokens.clear();
    drive.tokens.add('drive-token-2');

    await expect(client.getFile(file.id)).resolves.toMatchObject({
      id: file.id,
    });

    expect(onUnauthorized).toHaveBeenCalledExactlyOnceWith('drive-token-1');
    expect(drive.calls.map(call => call.headers.get('Authorization'))).toEqual([
      'Bearer drive-token-1',
      'Bearer drive-token-2',
    ]);
  });

  it('gives up after the renewed token gets a 401 too', async () => {
    const { drive, client, onUnauthorized } = setup();
    const file = drive.add({ name: 'orders.erd' });
    drive.tokens.clear();

    const error = await driveError(client.getFile(file.id));

    expect(error).toMatchObject({ kind: 'unauthorized', retryable: false });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(drive.calls).toHaveLength(2);
  });

  it('passes on a renewal that has no token to give', async () => {
    const { drive, client, onUnauthorized } = setup();
    const file = drive.add({ name: 'orders.erd' });
    drive.tokens.clear();
    onUnauthorized.mockRejectedValueOnce(
      new TokenUnavailableError('fallback-expired')
    );

    await expect(client.getFile(file.id)).rejects.toBeInstanceOf(
      TokenUnavailableError
    );
  });

  it.each([
    ['GET', 404, 'notFound', 'not-found', false],
    ['GET', 403, 'insufficientFilePermissions', 'forbidden', false],
    ['GET', 403, 'appNotAuthorizedToFile', 'forbidden', false],
    ['PATCH', 403, 'storageQuotaExceeded', 'quota', false],
    ['GET', 403, 'rateLimitExceeded', 'rate-limited', true],
    ['PATCH', 403, 'userRateLimitExceeded', 'rate-limited', true],
    ['GET', 429, 'rateLimitExceeded', 'rate-limited', true],
    ['GET', 500, 'backendError', 'server', true],
    ['PATCH', 503, 'backendError', 'server', true],
    ['GET', 400, 'badRequest', 'rejected', false],
    ['POST', 500, 'backendError', 'server', false],
    ['POST', 429, 'rateLimitExceeded', 'rate-limited', false],
  ] as const)(
    'reads %s %i %s as %s, retryable %s',
    async (method, status, reason, kind, retryable) => {
      const { drive, client } = setup();
      const file = drive.add({ name: 'orders.erd' });
      drive.failNext(method, status, reason);

      const call =
        method === 'GET'
          ? client.getFile(file.id)
          : method === 'PATCH'
            ? client.saveContent(file, '{}')
            : client.createFile({
                name: 'a.erd.json',
                parentId: 'folder-1',
                content: '{}',
              });
      const error = await driveError(call);

      expect(error).toMatchObject({ kind, status, reason, retryable });
      expect(error.message).not.toContain(file.id);
    }
  );

  it('reports a 403 for a token without drive.file and does not retry it', async () => {
    const { drive, client, onInsufficientScope } = setup();
    const file = drive.add({ name: 'orders.erd' });
    drive.failNext('GET', 403, 'insufficientPermissions');

    const error = await driveError(client.getFile(file.id));

    expect(error).toMatchObject({ kind: 'scope-missing', retryable: false });
    expect(onInsufficientScope).toHaveBeenCalledTimes(1);
  });

  it("reads Google's ACCESS_TOKEN_SCOPE_INSUFFICIENT detail as a missing scope", async () => {
    const onInsufficientScope = vi.fn();
    const client = createDriveClient({
      fetch: receiverChecked(async () =>
        jsonReply(
          {
            error: {
              code: 403,
              status: 'PERMISSION_DENIED',
              details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }],
            },
          },
          403
        )
      ),
      getAccessToken: async () => 't',
      onUnauthorized: async token => token,
      onInsufficientScope,
    });

    const error = await driveError(client.getFile('x'));

    expect(error.kind).toBe('scope-missing');
    expect(onInsufficientScope).toHaveBeenCalledTimes(1);
  });

  it('reads an error without a JSON body by its status alone', async () => {
    const client = createDriveClient({
      fetch: receiverChecked(
        async () => new Response('<html>', { status: 403 })
      ),
      getAccessToken: async () => 't',
      onUnauthorized: async token => token,
    });

    await expect(driveError(client.getFile('x'))).resolves.toMatchObject({
      kind: 'forbidden',
      reason: null,
      message: 'Drive request failed: forbidden',
    });
  });

  it.each([
    ['GET', true],
    ['PATCH', true],
    ['POST', false],
  ] as const)(
    'reads a network error of a %s as retryable %s',
    async (method, retryable) => {
      const { drive, client } = setup();
      const file = drive.add({ name: 'orders.erd' });
      drive.failNetworkNext(method);

      const call =
        method === 'GET'
          ? client.getFile(file.id)
          : method === 'PATCH'
            ? client.saveContent(file, '{}')
            : client.createFile({
                name: 'a.erd.json',
                parentId: 'folder-1',
                content: '{}',
              });

      await expect(driveError(call)).resolves.toMatchObject({
        kind: 'network',
        status: 0,
        retryable,
      });
    }
  );

  it.each([
    ['text', () => new Response('ok')],
    ['a JSON list', () => jsonReply([])],
    [
      'a file without modifiedTime',
      () => jsonReply({ id: 'x', name: 'a.erd', mimeType: 'a' }),
    ],
  ])('refuses %s as an invalid response', async (_label, reply) => {
    const client = createDriveClient({
      fetch: receiverChecked(async () => reply()),
      getAccessToken: async () => 't',
      onUnauthorized: async token => token,
    });

    await expect(driveError(client.getFile('x'))).resolves.toMatchObject({
      kind: 'invalid-response',
      retryable: false,
    });
  });

  it('refuses a save answer without the new modifiedTime', async () => {
    const client = createDriveClient({
      fetch: receiverChecked(async () => jsonReply({ id: 'x' })),
      getAccessToken: async () => 't',
      onUnauthorized: async token => token,
    });

    await expect(
      driveError(client.saveContent({ id: 'x', mimeType: 'a' }, '{}'))
    ).resolves.toMatchObject({ kind: 'invalid-response' });
  });

  it.each([
    ['a misspelled field', `/files/file-1?fields=id,canRenam`],
    [
      'a misspelled nested field',
      `/files/file-1?fields=capabilities(canRenam)`,
    ],
    ['a field of a file on the list', `/files?fields=files(id,canEdit)`],
    ['a sub-selection of a plain field', `/files/file-1?fields=name(id)`],
  ])('has the fake Drive refuse %s, as Drive does', async (_label, path) => {
    const drive = createFakeDrive();
    drive.add({ name: 'orders.erd' });
    const send = drive.fetch;

    const response = await send(`https://www.googleapis.com/drive/v3${path}`, {
      headers: { Authorization: 'Bearer drive-token-1' },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { errors: [{ reason: 'invalidParameter' }] },
    });
  });

  it('throws Illegal invocation through a fetch called with a receiver', async () => {
    const drive = createFakeDrive();
    const holder = { fetch: drive.fetch };
    expect(() =>
      holder.fetch('https://www.googleapis.com/drive/v3/files')
    ).toThrow('Illegal invocation');
  });
});

describe('parseDriveFile', () => {
  it('fills what Drive left out conservatively', () => {
    expect(
      parseDriveFile({
        id: 'x',
        name: 'a.erd',
        mimeType: 'application/json',
        modifiedTime: '2026-09-25T00:00:00.000Z',
        parents: ['p', 7],
        size: 'many',
      })
    ).toEqual({
      id: 'x',
      name: 'a.erd',
      mimeType: 'application/json',
      modifiedTime: '2026-09-25T00:00:00.000Z',
      size: null,
      trashed: false,
      parents: ['p'],
      canEdit: false,
      canRename: false,
    });
  });

  it('refuses what is not an object', () => {
    expect(() => parseDriveFile(null)).toThrow(DriveError);
  });
});

describe('withRetry', () => {
  const retryable = () => new DriveError('server', 503, 'backendError', true);

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the whole cycle again up to three times, backing off exponentially', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const cycle = vi.fn(async () => {
      throw retryable();
    });

    await expect(
      withRetry(cycle, { sleep, random: () => 0 })
    ).rejects.toMatchObject({ kind: 'server' });

    expect(cycle).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000, 4000]);
  });

  it('returns what a later attempt gets', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const cycle = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(retryable())
      .mockRejectedValueOnce(new DriveError('network', 0, null, true))
      .mockResolvedValueOnce('saved');

    await expect(withRetry(cycle, { sleep, random: () => 0 })).resolves.toBe(
      'saved'
    );
    expect(cycle).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['a conflict-free refusal', new DriveError('forbidden', 403, null, false)],
    ['an error that is not Drive', new TokenUnavailableError('signed-out')],
  ])('stops at once on %s', async (_label, error) => {
    const sleep = vi.fn(async (_ms: number) => {});
    const cycle = vi.fn(async () => {
      throw error;
    });

    await expect(withRetry(cycle, { sleep })).rejects.toBe(error);
    expect(cycle).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('repeats the metadata check with the save, never the PATCH alone', async () => {
    const { drive, client } = setup();
    const file = drive.add({ name: 'orders.erd' });
    drive.failNetworkNext('PATCH');
    const base = file.modifiedTime;

    await withRetry(
      async () => {
        const remote = await client.getFile(file.id);
        if (remote.modifiedTime !== base) throw new Error('conflict');
        return client.saveContent(remote, '{"saved":true}');
      },
      { sleep: async () => {}, random: () => 0 }
    );

    expect(drive.calls.map(call => call.method)).toEqual([
      'GET',
      'PATCH',
      'GET',
      'PATCH',
    ]);
  });

  it('never sends a create twice', async () => {
    const { drive, client } = setup();
    drive.failNext('POST', 503);

    await expect(
      withRetry(
        () =>
          client.createFile({
            name: 'a.erd.json',
            parentId: 'folder-1',
            content: '{}',
          }),
        { sleep: async () => {} }
      )
    ).rejects.toMatchObject({ kind: 'server', retryable: false });
    expect(drive.callsTo('POST')).toHaveLength(1);
  });

  it('waits for real between attempts by default', async () => {
    vi.useFakeTimers();
    const cycle = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(retryable())
      .mockResolvedValueOnce('ok');

    const result = withRetry(cycle, { random: () => 0 });
    await vi.advanceTimersByTimeAsync(999);
    expect(cycle).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toBe('ok');
  });

  it('adds up to a quarter second of jitter', () => {
    expect(backoffDelay(0, () => 0.5)).toBe(1125);
    expect(backoffDelay(2, () => 0.999)).toBe(4249);
  });
});

describe('the fake Drive', () => {
  const list = ({ fetch: send }: FakeDrive, q: string) =>
    send(
      `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ q, fields: 'files(id)' })}`,
      { headers: { Authorization: 'Bearer drive-token-1' } }
    );

  it('lists only what a query matches, and refuses a query it cannot read', async () => {
    const drive = createFakeDrive();
    const folder = drive.add({
      name: 'ERD Editor',
      mimeType: FOLDER_MIME,
      appProperties: MARKER,
    });
    drive.add({ name: 'a.erd' });

    await expect((await list(drive, APP_FOLDER_QUERY)).json()).resolves.toEqual(
      { files: [{ id: folder.id }] }
    );
    const otherKey = APP_FOLDER_QUERY.replace('erdEditorFolder', 'other');
    await expect((await list(drive, otherKey)).json()).resolves.toEqual({
      files: [],
    });
    for (const q of [
      "name = 'ERD Editor'",
      `${APP_FOLDER_QUERY} or trashed=true`,
      'trashed=false and',
    ]) {
      const refused = await list(drive, q);
      expect(refused.status).toBe(400);
    }
  });

  it('creates into a folder it can see and add to alone, and into the trash with a trashed one', async () => {
    const { drive, client } = setup();
    const shared = drive.add({
      name: 'Shared',
      mimeType: FOLDER_MIME,
      resourceKey: 'key',
    });
    const viewed = drive.add({
      name: 'Viewed',
      mimeType: FOLDER_MIME,
      canEdit: false,
    });
    const file = drive.add({ name: 'a.erd' });
    const trashed = drive.add({
      name: 'Old',
      mimeType: FOLDER_MIME,
      trashed: true,
    });
    const create = (parentId: string) =>
      client.createFile({ name: 'a.erd.json', parentId, content: '{}' });

    await expect(driveError(create('missing'))).resolves.toMatchObject({
      kind: 'not-found',
    });
    await expect(driveError(create(shared.id))).resolves.toMatchObject({
      kind: 'not-found',
    });
    for (const parent of [viewed, file]) {
      await expect(driveError(create(parent.id))).resolves.toMatchObject({
        kind: 'forbidden',
      });
    }
    const created = await create(trashed.id);
    expect(created.trashed).toBe(true);
    trashed.trashed = false;
    await expect(client.getFile(created.id)).resolves.toMatchObject({
      trashed: false,
    });
  });

  it('puts a file in the trash and the shared drive of the folders above it', async () => {
    const { drive, client } = setup();
    const send = drive.fetch;
    const top = drive.add({ name: 'Top', mimeType: FOLDER_MIME });
    const inner = drive.add({
      name: 'Inner',
      mimeType: FOLDER_MIME,
      parents: [top.id],
    });
    const file = drive.add({ name: 'a.erd', parents: [inner.id] });
    // A loop of parents, which Drive never has, ends the walk all the same.
    top.parents = [inner.id];
    const listed = async () =>
      (await client.listFiles()).map(entry => entry.name);
    const get = (path: string, init: RequestInit = {}) =>
      send(`https://www.googleapis.com${path}`, {
        ...init,
        headers: { Authorization: 'Bearer drive-token-1', ...init.headers },
      });

    top.trashed = true;
    await expect(client.getFile(file.id)).resolves.toMatchObject({
      trashed: true,
    });
    await expect(listed()).resolves.toEqual([]);
    top.trashed = false;
    await expect(listed()).resolves.toEqual(['a.erd']);

    // Out of a list unless it asks for every drive, and out of reach unless it supports them.
    top.driveId = 'team-drive';
    await expect(listed()).resolves.toEqual([]);
    const everywhere = await get(
      '/drive/v3/files?includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,driveId)'
    );
    await expect(everywhere.json()).resolves.toEqual({
      files: expect.arrayContaining([{ id: file.id, driveId: 'team-drive' }]),
    });
    expect((await get(`/drive/v3/files/${file.id}?fields=id`)).status).toBe(
      404
    );
    await expect(client.getFile(file.id)).resolves.toMatchObject({
      name: 'a.erd',
    });
    const upload = await get('/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=b' },
      body: [
        '--b',
        'Content-Type: application/json',
        '',
        JSON.stringify({ name: 'b.erd.json', parents: [inner.id] }),
        '--b',
        'Content-Type: application/json',
        '',
        '{}',
        '--b--',
      ].join('\r\n'),
    });
    expect(upload.status).toBe(404);
    await expect(
      client.createFile({ name: 'c.erd.json', parentId: inner.id, content: '' })
    ).resolves.toMatchObject({ parents: [inner.id] });
  });
});

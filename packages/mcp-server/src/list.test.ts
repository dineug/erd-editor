import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { emptyDocument } from '@/__test-utils__/documents';
import { createFakeHub } from '@/__test-utils__/fakeHub';
import { connectMcp, type McpHarness } from '@/__test-utils__/mcp';
import { createMemoryHost, type MemoryHost } from '@/__test-utils__/memoryHost';
import { MAX_LIST_DEPTH, MAX_LISTED_DOCUMENTS } from '@/session/disk';

let io: MemoryHost;
let mcp: McpHarness;

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io = createMemoryHost();
  mcp = await connectMcp({ host: io });
});

afterEach(async () => {
  await mcp.close();
  vi.restoreAllMocks();
});

const closed = (path: string) => ({
  path,
  open: false,
  active: false,
  dirty: false,
  readonly: false,
});

describe('erd_list_documents (AC-M6)', () => {
  it('asks the window serving the working directory, with every field', async () => {
    io.put('/work/a.erd.json', emptyDocument());
    io.put('/work/b.vuerd.json', emptyDocument());
    const hub = createFakeHub(io, { pid: 1212, workspaceFolders: ['/work'] });
    hub.open('/work/a.erd.json');
    await mcp.ok('erd_add_table', { path: '/work/a.erd.json' });

    const listed = await mcp.ok('erd_list_documents');

    expect(listed.mode).toBe('live');
    expect(listed.documents).toEqual([
      {
        path: '/work/a.erd.json',
        open: true,
        active: false,
        dirty: true,
        readonly: false,
      },
      closed('/work/b.vuerd.json'),
    ]);
    expect(hub.connections.size).toBe(1);
    hub.destroy();
  });

  it('lists the ERD files under the working directory when no hub serves it', async () => {
    io.put('/work/a.erd.json', emptyDocument());
    io.put('/work/docs/b.erd', emptyDocument());
    io.put('/work/docs/readme.md', '#');
    io.put('/work/node_modules/pkg/c.erd.json', emptyDocument());
    io.put('/work/.git/d.erd.json', emptyDocument());
    io.put('/elsewhere/e.erd.json', emptyDocument());

    const listed = await mcp.ok('erd_list_documents');

    expect(listed).toEqual({
      mode: 'headless',
      documents: [closed('/work/a.erd.json'), closed('/work/docs/b.erd')],
    });
  });

  it('reports a file without owner write as readonly, as a headless write refuses it', async () => {
    io.put('/work/a.erd.json', emptyDocument());
    io.put('/work/b.erd.json', emptyDocument(), 0o444);
    io.put('/work/c.erd.json', emptyDocument(), 0o400);
    io.put('/work/d.erd.json', emptyDocument(), 0o200);

    const listed = await mcp.ok('erd_list_documents');

    expect(listed.documents).toEqual([
      closed('/work/a.erd.json'),
      { ...closed('/work/b.erd.json'), readonly: true },
      { ...closed('/work/c.erd.json'), readonly: true },
      closed('/work/d.erd.json'),
    ]);
    const refused = await mcp.call('erd_add_table', {
      path: '/work/b.erd.json',
    });
    expect(refused.json.error.code).toBe('readonly');
  });

  it.each([
    ['win32', ['/work/a.erd.json']],
    [
      'linux',
      [
        '/work/a.erd.json',
        '/work/NUL.erd',
        '/work/orders:v2.erd',
        '/work/sub./x.erd',
      ],
    ],
  ])(
    'leaves out on %s every name a call there refuses',
    async (platform, paths) => {
      const host = createMemoryHost({ platform });
      const names = ['a.erd.json', 'NUL.erd', 'orders:v2.erd', 'sub./x.erd'];
      for (const name of names) host.put(`/work/${name}`, emptyDocument());
      const harness = await connectMcp({ host });

      try {
        const listed = await harness.ok('erd_list_documents');

        expect(listed).toEqual({
          mode: 'headless',
          documents: paths.map(closed),
        });
      } finally {
        await harness.close();
      }
    }
  );

  it('stops at its depth and count limits', async () => {
    const deep = `/work/${Array.from({ length: MAX_LIST_DEPTH + 1 }, (_, i) => `d${i}`).join('/')}`;
    io.put(`${deep}/too-deep.erd.json`, '{}');
    for (let i = 0; i < MAX_LISTED_DOCUMENTS + 5; i++) {
      io.put(`/work/many/${String(i).padStart(4, '0')}.erd.json`, '{}');
    }

    const listed = await mcp.ok('erd_list_documents');

    expect(listed.documents).toHaveLength(MAX_LISTED_DOCUMENTS);
    expect(
      listed.documents.some(({ path }: { path: string }) =>
        path.includes('too-deep')
      )
    ).toBe(false);
  });

  it('reports a hub that cannot be reached', async () => {
    const hub = createFakeHub(io, { pid: 1313, workspaceFolders: ['/work'] });
    io.servers.delete(hub.pipe);

    const refused = await mcp.call('erd_list_documents');
    expect(refused.json.error.code).toBe('hubUnreachable');
  });
});

import { toSvg } from '@dineug/erd-editor/svg.js';
import { Effect } from 'effect';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  documentFromSql,
  SHOP_SQL,
  tableNamed,
} from '@/__test-utils__/documents';
import { createFakeHub } from '@/__test-utils__/fakeHub';
import { connectMcp, type McpHarness, settle } from '@/__test-utils__/mcp';
import { fsError } from '@/__test-utils__/memoryFs';
import { createMemoryHost, type MemoryHost } from '@/__test-utils__/memoryHost';
import { writeFileReplacing } from '@/session/disk';
import { diskReadNote } from '@/session/manager';
import { runTool } from '@/tools/run';
import { svgSize } from '@/tools/svg';

vi.mock('@dineug/erd-editor/svg.js', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@dineug/erd-editor/svg.js')>();
  return { ...actual, toSvg: vi.fn(actual.toSvg) };
});

const actual = await vi.importActual<
  typeof import('@dineug/erd-editor/svg.js')
>('@dineug/erd-editor/svg.js');

const DOCUMENT = '/work/shop.erd.json';
const OUTPUT = '/work/docs/shop.svg';

/**
 * An svg of the given length, which a spec of the read bound has toSvg answer,
 * since drawing a document that long took past five seconds on a CI runner.
 */
const svgOfLength = (length: number) => {
  const head =
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20">';
  const tail = '</svg>';
  return head + 'x'.repeat(length - head.length - tail.length) + tail;
};

let io: MemoryHost;
let mcp: McpHarness;
let shop: string;

beforeAll(() => {
  shop = documentFromSql(SHOP_SQL);
});

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.mocked(toSvg).mockClear().mockImplementation(actual.toSvg);
  io = createMemoryHost();
  io.put(DOCUMENT, shop);
  io.mkdir('/work/docs');
});

afterEach(async () => {
  await mcp?.close();
  vi.restoreAllMocks();
});

const connect = async (host = io) => {
  mcp = await connectMcp({ host });
  return mcp;
};

describe('erd_export_svg to a file', () => {
  it('draws the document as toSvg does and writes a new file with one exclusive create', async () => {
    await connect();
    const writes = io.writes.length;

    const result = await mcp.ok('erd_export_svg', {
      path: 'shop.erd.json',
      output: 'docs/shop.svg',
    });

    const svg = io.read(OUTPUT);
    expect(svg).toBe(await actual.toSvg(shop));
    expect(result).toEqual({
      mode: 'headless',
      path: DOCUMENT,
      output: OUTPUT,
      bytes: Buffer.byteLength(svg, 'utf8'),
      ...svgSize(svg),
    });
    expect(result.width).toBeGreaterThan(0);
    expect(svg).toMatch(/^<svg xmlns=[^>]* width="\d+" height="\d+" viewBox=/);
    expect(io.writes.slice(writes)).toEqual([OUTPUT]);
    expect(io.read(DOCUMENT)).toBe(shop);
  });

  it('passes the dark theme and a transparent background to the drawing', async () => {
    await connect();

    await mcp.ok('erd_export_svg', {
      path: DOCUMENT,
      output: OUTPUT,
      darkMode: true,
      background: false,
    });

    const svg = io.read(OUTPUT);
    expect(svg).toBe(
      await actual.toSvg(shop, { darkMode: true, background: false })
    );
    expect(svg).not.toBe(await actual.toSvg(shop));
  });

  it('replaces a file already there through a temp file, keeping its mode', async () => {
    io.put(OUTPUT, '<svg/>', 0o600);
    await connect();
    const writes = io.writes.length;

    await mcp.ok('erd_export_svg', { path: DOCUMENT, output: OUTPUT });

    const temp = '/work/docs/.shop.svg.id1.tmp';
    expect(io.read(OUTPUT)).toBe(await actual.toSvg(shop));
    expect(io.writes.slice(writes)).toEqual([temp, OUTPUT]);
    expect(io.files.has(temp)).toBe(false);
    expect(io.files.get(OUTPUT)!.mode).toBe(0o600);
  });

  it('keeps a group’s write bit on the file it replaces, which the umask takes from the temp file', async () => {
    io.put(OUTPUT, '<svg/>', 0o664);
    await connect();

    await mcp.ok('erd_export_svg', { path: DOCUMENT, output: OUTPUT });

    expect(io.read(OUTPUT)).toBe(await actual.toSvg(shop));
    expect(io.files.get(OUTPUT)!.mode).toBe(0o664);
  });

  it('counts the bytes it wrote in UTF-8, past the characters of a name outside ASCII', async () => {
    const json = JSON.parse(shop);
    Object.values<{ name: string }>(json.collections.tableEntities).find(
      table => table.name === 'users'
    )!.name = '회원';
    io.put(DOCUMENT, JSON.stringify(json));
    await connect();

    const result = await mcp.ok('erd_export_svg', {
      path: DOCUMENT,
      output: OUTPUT,
    });

    const svg = io.read(OUTPUT);
    expect(svg).toContain('>회원<');
    expect(result.bytes).toBe(Buffer.byteLength(svg, 'utf8'));
    expect(result.bytes).toBeGreaterThan(svg.length);
  });

  it('refuses a read-only file already there, leaving it as it was', async () => {
    io.put(OUTPUT, '<svg/>', 0o444);
    await connect();

    const refused = await mcp.call('erd_export_svg', {
      path: DOCUMENT,
      output: OUTPUT,
    });

    expect(refused.isError).toBe(true);
    expect(refused.json.error).toEqual({
      code: 'readonly',
      message: `${OUTPUT} is read-only, so it was not written; make it writable or name another file, then call again`,
    });
    expect(io.read(OUTPUT)).toBe('<svg/>');
    expect([...io.files.keys()].filter(path => path.endsWith('.tmp'))).toEqual(
      []
    );
  });

  it.each([
    [
      'docs/shop.png',
      'invalidPath',
      '/work/docs/shop.png is not an svg file; name a file ending in .svg',
    ],
    [
      'missing/shop.svg',
      'notFound',
      'The folder of /work/missing/shop.svg does not exist; make it first, or name a file in a folder that does',
    ],
  ])(
    'refuses output %s before reading or drawing anything',
    async (output, code, message) => {
      await connect();

      const refused = await mcp.call('erd_export_svg', {
        path: DOCUMENT,
        output,
      });

      expect(refused.json.error).toEqual({ code, message });
      expect(toSvg).not.toHaveBeenCalled();
      expect(mcp.manager.paths()).toEqual([]);
    }
  );

  it('refuses an output that is a link to no file before reading or drawing anything', async () => {
    io.links.set(OUTPUT, '/work/build/shop.svg');
    await connect();

    const refused = await mcp.call('erd_export_svg', {
      path: DOCUMENT,
      output: OUTPUT,
    });

    expect(refused.json.error).toEqual({
      code: 'invalidPath',
      message: `${OUTPUT} is a link to /work/build/shop.svg, which leads to no file; name the file it should lead to as output, or another path`,
    });
    expect(toSvg).not.toHaveBeenCalled();
    expect(io.links.get(OUTPUT)).toBe('/work/build/shop.svg');
  });

  it('retries the rename on Windows while another program holds the file open', async () => {
    const win = createMemoryHost({ platform: 'win32' });
    win.put(DOCUMENT, shop);
    win.put(OUTPUT, '<svg/>');
    const rename = win.calls.rename;
    const tags = ['Unknown', 'PermissionDenied', 'Busy'] as const;
    let attempts = 0;
    win.calls.rename = (from, to) => {
      const tag = tags[attempts++];
      return tag ? Effect.fail(fsError(tag, 'rename', from)) : rename(from, to);
    };
    await connect(win);

    await mcp.ok('erd_export_svg', { path: DOCUMENT, output: OUTPUT });

    expect(attempts).toBe(4);
    expect(win.read(OUTPUT)).toBe(await actual.toSvg(shop));
    expect(win.files.has('/work/docs/.shop.svg.id1.tmp')).toBe(false);
  });
});

describe('erd_export_svg answering the text', () => {
  it('answers the svg as a read does, its mode in a second block', async () => {
    await connect();

    const result = await mcp.call('erd_export_svg', { path: DOCUMENT });

    expect(result.isError).toBe(false);
    expect(result.texts).toEqual([
      await actual.toSvg(shop),
      JSON.stringify({ mode: 'headless' }),
    ]);
    expect(io.files.has(OUTPUT)).toBe(false);
  });

  it('answers a drawing of exactly what one answer holds, and refuses one past it, naming output', async () => {
    await connect();
    vi.mocked(toSvg).mockResolvedValueOnce(svgOfLength(40_000));

    const fits = await mcp.call('erd_export_svg', { path: DOCUMENT });

    expect(fits.isError).toBe(false);
    expect(fits.texts[0]).toBe(svgOfLength(40_000));

    const over = svgOfLength(40_001);
    vi.mocked(toSvg).mockResolvedValue(over);
    const refused = await mcp.call('erd_export_svg', { path: DOCUMENT });

    expect(refused.isError).toBe(true);
    expect(refused.json.error).toEqual({
      code: 'tooLarge',
      message:
        'this svg is 40,001 characters, over the 40,000 one answer returns; pass output, a .svg path, to have it written to that file',
    });
    const written = await mcp.ok('erd_export_svg', {
      path: DOCUMENT,
      output: OUTPUT,
    });
    expect(io.read(OUTPUT)).toBe(over);
    expect(written.bytes).toBe(40_001);
  });
});

describe('erd_export_svg on an editor', () => {
  it('draws what the editor holds live, edits not yet saved included', async () => {
    const hub = createFakeHub(io, { pid: 4545, workspaceFolders: ['/work'] });
    hub.open(DOCUMENT);
    await connect();
    const snapshot = JSON.parse(
      await mcp.text('erd_read', { path: DOCUMENT, format: 'snapshot' })
    );

    await mcp.ok('erd_change_table_name', {
      path: DOCUMENT,
      tableId: tableNamed(snapshot, 'users').id,
      value: 'members',
    });
    runTool(hub.webview(DOCUMENT), 'erd_change_table_name', {
      tableId: tableNamed(snapshot, 'orders').id,
      value: 'purchases',
    });
    await settle();

    const result = await mcp.call('erd_export_svg', { path: DOCUMENT });
    expect(JSON.parse(result.texts[1])).toEqual({ mode: 'live' });
    expect(result.text).toContain('>members<');
    expect(result.text).toContain('>purchases<');
    expect(result.text).not.toContain('>users<');
    // VS Code keeps both edits unsaved, so the file still has the old names.
    expect(io.read(DOCUMENT)).toBe(shop);
    hub.destroy();
  });

  it('draws the file under a window whose hub is off, saying unsaved edits are missing', async () => {
    const hub = createFakeHub(io, {
      pid: 7171,
      workspaceFolders: ['/work'],
      hub: false,
    });
    await connect();

    const result = await mcp.ok('erd_export_svg', {
      path: DOCUMENT,
      output: OUTPUT,
    });

    expect(result).toMatchObject({
      mode: 'blocked',
      output: OUTPUT,
      notes: [diskReadNote('vscode')],
    });
    expect(io.read(OUTPUT)).toBe(await actual.toSvg(shop));
    hub.destroy();
  });
});

describe('erd_export_svg beside other calls', () => {
  /** Holds every drawing until release is called, noting when each starts and ends. */
  const holdDrawings = () => {
    const events: string[] = [];
    let release!: () => void;
    const released = new Promise<void>(resolve => (release = resolve));
    vi.mocked(toSvg).mockImplementation(async (value, options) => {
      events.push('start');
      await released;
      try {
        return await actual.toSvg(value, options);
      } finally {
        events.push('end');
      }
    });
    return { events, release };
  };

  it('draws outside the document line, so a later read of it answers first', async () => {
    await connect();
    const { events, release } = holdDrawings();

    const exported = mcp.call('erd_export_svg', { path: DOCUMENT });
    try {
      await vi.waitFor(() => expect(events).toEqual(['start']));
      const read = await mcp.text('erd_read', {
        path: DOCUMENT,
        format: 'scripts',
      });
      expect(read).toBe('{"before":"","after":""}');
      expect(events).toEqual(['start']);
    } finally {
      release();
    }
    expect((await exported).isError).toBe(false);
    expect(events).toEqual(['start', 'end']);
  });

  it('draws one export at a time, even of two documents', async () => {
    io.put('/work/other.erd.json', shop);
    await connect();
    const { events, release } = holdDrawings();

    const first = mcp.call('erd_export_svg', { path: DOCUMENT });
    const second = mcp.call('erd_export_svg', {
      path: '/work/other.erd.json',
    });
    try {
      await vi.waitFor(() => expect(events).toEqual(['start']));
      await settle(20);
      expect(events).toEqual(['start']);
    } finally {
      release();
    }
    const answers = await Promise.all([first, second]);
    expect(answers.map(({ isError }) => isError)).toEqual([false, false]);
    expect(events).toEqual(['start', 'end', 'start', 'end']);
  });

  /** Sends a tools/call without waiting for it, so the spec can cancel it. */
  const start = (id: number, args: Record<string, unknown>) =>
    mcp.stdio.send({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name: 'erd_export_svg', arguments: args },
    });

  /** The responses the server sent to the request of this id. */
  const answersTo = (id: number) => {
    const answers: unknown[] = [];
    mcp.stdio.onLine(message => {
      if (message.id === id) answers.push(message);
    });
    return answers;
  };

  it('draws and writes to the end an export the client cancelled once it drew, leaving no temp file', async () => {
    io.put(OUTPUT, '<svg/>');
    await connect();
    const { events, release } = holdDrawings();
    const answers = answersTo(910);

    start(910, { path: DOCUMENT, output: OUTPUT });
    try {
      await vi.waitFor(() => expect(events).toEqual(['start']));
      mcp.notify('notifications/cancelled', { requestId: 910, reason: 'user' });
      await settle(20);
    } finally {
      release();
    }
    await vi.waitFor(() => expect(io.read(OUTPUT)).not.toBe('<svg/>'));

    expect(io.read(OUTPUT)).toBe(await actual.toSvg(shop));
    expect([...io.files.keys()].filter(path => path.endsWith('.tmp'))).toEqual(
      []
    );
    expect(events).toEqual(['start', 'end']);
    expect(answers).toEqual([]);
  });

  it('never draws an export the client cancelled as it waited for its turn', async () => {
    io.put('/work/other.erd.json', shop);
    await connect();
    const { events, release } = holdDrawings();
    const answers = answersTo(911);

    const first = mcp.call('erd_export_svg', { path: DOCUMENT });
    try {
      await vi.waitFor(() => expect(events).toEqual(['start']));
      start(911, { path: '/work/other.erd.json', output: OUTPUT });
      await settle(20);
      mcp.notify('notifications/cancelled', { requestId: 911, reason: 'user' });
      await settle(20);
    } finally {
      release();
    }

    expect((await first).isError).toBe(false);
    await settle(20);
    await mcp.ok('erd_read', { path: DOCUMENT, format: 'scripts' });
    expect(events).toEqual(['start', 'end']);
    expect(io.files.has(OUTPUT)).toBe(false);
    expect(answers).toEqual([]);
  });
});

describe('erd_export_svg when the drawing fails', () => {
  it('answers what toSvg threw as internal, writing nothing, and draws the next call', async () => {
    await connect();
    vi.mocked(toSvg).mockRejectedValueOnce(new TypeError('no scene'));

    const failed = await mcp.call('erd_export_svg', {
      path: DOCUMENT,
      output: OUTPUT,
    });

    expect(failed.json.error).toEqual({
      code: 'internal',
      message: 'no scene',
    });
    expect(io.files.has(OUTPUT)).toBe(false);
    expect(console.error).toHaveBeenCalled();
    await mcp.ok('erd_export_svg', { path: DOCUMENT, output: OUTPUT });
    expect(io.read(OUTPUT)).toBe(await actual.toSvg(shop));
  });
});

describe('writeFileReplacing', () => {
  it('refuses as notFound an entry the create meets that leads to no file, a link made since the lookup say', async () => {
    io.links.set(OUTPUT, '/work/docs/missing.svg');
    io.calls.writeFileString = path =>
      Effect.fail(fsError('AlreadyExists', 'writeFile', path));

    await expect(
      io.run(writeFileReplacing(OUTPUT, '<svg/>'))
    ).rejects.toMatchObject({
      code: 'notFound',
      message: `${OUTPUT} is there but leads to no file, a link to a missing one say, so it was not written; name another file`,
    });
  });

  it('refuses a folder gone before the write as notFound', async () => {
    await expect(
      io.run(writeFileReplacing('/gone/shop.svg', '<svg/>'))
    ).rejects.toMatchObject({
      code: 'notFound',
      message: 'The folder of /gone/shop.svg does not exist',
    });
  });

  it('passes on another failure of the create, writing nothing', async () => {
    io.calls.writeFileString = path =>
      Effect.fail(fsError('PermissionDenied', 'writeFile', path));

    await expect(
      io.run(writeFileReplacing(OUTPUT, '<svg/>'))
    ).rejects.toMatchObject({ reason: { _tag: 'PermissionDenied' } });
    expect(io.files.has(OUTPUT)).toBe(false);
  });

  it('removes its temp file when the rename fails, leaving the file as it was', async () => {
    io.put(OUTPUT, '<svg/>');
    io.calls.rename = from => Effect.fail(fsError('Busy', 'rename', from));

    await expect(
      io.run(writeFileReplacing(OUTPUT, '<svg></svg>'))
    ).rejects.toMatchObject({ reason: { _tag: 'Busy' } });
    expect(io.read(OUTPUT)).toBe('<svg/>');
    expect([...io.files.keys()].filter(path => path.endsWith('.tmp'))).toEqual(
      []
    );
  });
});

describe('svgSize', () => {
  it('reads the width and height of the root element, NaN where one is missing', () => {
    expect(
      svgSize('<svg width="12" height="34" viewBox="0 0 12 34"/>')
    ).toEqual({ width: 12, height: 34 });
    expect(svgSize('<g width="1"/>')).toEqual({
      width: Number.NaN,
      height: Number.NaN,
    });
  });
});

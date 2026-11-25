// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';

import { TABLE_BORDER } from '@/constants/layout';
import { NameViewMode } from '@/constants/schema';
import {
  createPeerStore,
  measureTableSize,
  memoActions,
  memoActions$,
  tableActions$,
} from '@/peer';
import {
  createPresetExportTheme,
  TRANSPARENT_BACKGROUND,
} from '@/services/export-png/exportTheme';

import { tableToWidth } from './nodeTextWidth';
import { toSvg, type ToSvgOptions } from './toSvg';

const fixture = (name: string) =>
  readFileSync(join(process.cwd(), '..', '..', 'data', name), 'utf8');

const SMALL = fixture('embed-small.erd.json');
const BOOKSTORE = fixture('bookstore.erd.json');

/** The words an svg writes, each text or line konva drew. */
const textsOf = (svg: string) =>
  [...svg.matchAll(/<(?:text|tspan)\b[^>]*>([^<]+)</g)].map(([, text]) => text);

/** The small fixture with one table changed, by its physical name. */
function withTable(name: string, change: Record<string, unknown>) {
  const json = JSON.parse(SMALL);
  const table = Object.values<{ name: string }>(
    json.collections.tableEntities
  ).find(entity => entity.name === name)!;
  Object.assign(table, change);
  return json;
}

/** A document of one memo holding the value given, written by a peer as an agent would. */
async function memoDocument(value: string) {
  const peer = createPeerStore({ nickname: 'svg', presence: false });
  peer.dispatch([memoActions$.addMemoAction$()]);
  const [id] = peer.state.doc.memoIds;
  peer.dispatch([memoActions.changeMemoValueAction({ id, value })]);
  await new Promise(resolve => setImmediate(resolve));
  const document = peer.value;
  peer.destroy();
  return document;
}

const consoleErrors = vi.spyOn(console, 'error');

let small: string;

// The first drawing loads the scene's modules, which takes longer than a case
// is given, so it happens once, ahead of the cases that read it.
beforeAll(async () => {
  expect(Reflect.get(globalThis, 'document')).toBeUndefined();
  small = await toSvg(SMALL);
});

afterEach(() => {
  expect(consoleErrors).not.toHaveBeenCalled();
  consoleErrors.mockClear();
});

describe('toSvg in a realm with no document', () => {
  it('draws a document as one svg element, sized by its box', () => {
    expect(small).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="\d+" viewBox="[-\d ]+"/
    );
    expect(small.endsWith('</svg>')).toBe(true);
    expect(textsOf(small)).toEqual(
      expect.arrayContaining(['books', 'publishers', 'authors', 'book_authors'])
    );
  });

  it('draws the same text every time, byte for byte', async () => {
    expect(await toSvg(SMALL)).toBe(small);
    expect(await toSvg(BOOKSTORE)).toBe(await toSvg(BOOKSTORE));
  });

  it('draws calls made together as it draws each alone', async () => {
    const values = [SMALL, BOOKSTORE, SMALL, BOOKSTORE];
    const alone: string[] = [];
    for (const value of values) alone.push(await toSvg(value));

    expect(await Promise.all(values.map(value => toSvg(value)))).toEqual(alone);
  });

  it('draws as it draws alone while peers load and edit documents beside it', async () => {
    const alone = await toSvg(BOOKSTORE);
    const editing = createPeerStore({ nickname: 'svg', presence: false });
    editing.setInitialValue(BOOKSTORE);
    let sorts = 0;
    const drawing = toSvg(BOOKSTORE);
    // Set before the scene's own wait for its load to settle, so each one
    // sorts twice, a load and an edit, while the scene's routes are read.
    const beside = [4, 8, 12, 16, 20, 24, 28, 31].map(ms =>
      setTimeout(() => {
        const loading = createPeerStore({ nickname: 'svg', presence: false });
        loading.setInitialValue(SMALL);
        loading.destroy();
        editing.dispatch([tableActions$.addTableAction$()]);
        sorts += 1;
      }, ms)
    );

    try {
      expect(await drawing).toBe(alone);
    } finally {
      beside.forEach(clearTimeout);
      editing.destroy();
    }
    expect(sorts).toBe(beside.length);
  });

  it.each([
    ['embed-small.erd.json', () => SMALL],
    ['bookstore.erd.json', () => BOOKSTORE],
  ])(
    'lays each table out in the room the width table gives, margin included: %s',
    async (_, valueOf) => {
      const peer = createPeerStore({ nickname: 'svg', presence: false });
      peer.setInitialValue(valueOf());
      const { state } = peer;
      const tables = state.doc.tableIds.map(id => {
        const table = state.collections.tableEntities[id]!;
        const { width } = measureTableSize(table, state, tableToWidth);
        return { at: `${table.ui.x} ${table.ui.y}`, width };
      });
      peer.destroy();

      // A table opens a group at its point, which the origin writes no group
      // for, with its body, one border narrower than the table.
      const bodies = new Map(
        [
          ...(await toSvg(valueOf())).matchAll(
            /(?:<g transform="translate\(([-\d.]+ [-\d.]+)\)">)?<rect transform="translate\(0\.5 0\.5\)" width="([\d.]+)"/g
          ),
        ].map(([, at = '0 0', width]) => [at, Number(width) + TABLE_BORDER])
      );

      expect(tables.length).toBeGreaterThan(3);
      expect(tables.map(({ at }) => bodies.get(at))).toEqual(
        tables.map(({ width }) => width)
      );
    }
  );

  it('draws the table groups, a box and a title each', async () => {
    const svg = await toSvg(BOOKSTORE);

    expect(textsOf(svg)).toEqual(expect.arrayContaining(['catalog', 'sales']));
    expect(
      svg.match(/<rect[^>]*\brx="6"[^>]*stroke=/g)?.length
    ).toBeGreaterThan(1);
  });

  it('keeps the body of a memo that holds an emoji', async () => {
    const svg = await toSvg(await memoDocument('ship it 🚀\nsecond line'));

    expect(textsOf(svg).join('\n')).toContain('ship it');
    expect(textsOf(svg)).toContain('second line');
  });

  it('writes the scene’s own words in English', async () => {
    const svg = await toSvg(JSON.stringify(withTable('books', { name: '' })));

    expect(textsOf(svg)).toContain('table');
    expect(textsOf(svg)).not.toContain('books');
  });

  it('writes the names in the name view the document holds', async () => {
    const json = withTable('books', { logicalName: 'Book' });
    const physical = await toSvg(JSON.stringify(json));
    json.settings.nameViewMode = NameViewMode.logical;
    const logical = await toSvg(JSON.stringify(json));

    expect(textsOf(physical)).toContain('books');
    expect(textsOf(physical)).not.toContain('Book');
    expect(textsOf(logical)).toContain('Book');
    expect(textsOf(logical)).not.toContain('books');
  });

  it('paints the light preset behind the diagram by default', async () => {
    const light = createPresetExportTheme({
      darkMode: false,
      background: true,
    });

    expect(small).toContain(`fill="${light.canvasBackground}"`);
    expect(await toSvg(SMALL, {})).toBe(small);
  });

  it('paints the dark preset in dark mode', async () => {
    const dark = createPresetExportTheme({ darkMode: true, background: true });
    const svg = await toSvg(SMALL, { darkMode: true });

    expect(svg).toContain(`fill="${dark.canvasBackground}"`);
    expect(svg).not.toBe(small);
  });

  it('paints nothing behind the diagram with the background off', async () => {
    const light = createPresetExportTheme({
      darkMode: false,
      background: true,
    });
    const svg = await toSvg(SMALL, { background: false });

    expect(svg).not.toContain(`fill="${light.canvasBackground}"`);
    expect(svg).not.toContain(TRANSPARENT_BACKGROUND);
    expect(textsOf(svg)).toEqual(textsOf(small));
  });

  it('draws an empty document for empty text', async () => {
    const svg = await toSvg('  ');

    expect(svg.startsWith('<svg ')).toBe(true);
    expect(textsOf(svg)).toEqual([]);
  });
});

describe('what toSvg refuses before it draws', () => {
  it.each<[string, Partial<Record<keyof ToSvgOptions, unknown>>]>([
    ['background', { background: 'false' }],
    ['background', { background: null }],
    ['darkMode', { darkMode: 1 }],
  ])('a %s it does not take, naming it: %j', async (name, options) => {
    await expect(
      toSvg(SMALL, options as unknown as ToSvgOptions)
    ).rejects.toThrow(new RegExp(`^toSvg: ${name} cannot be`));
    await expect(
      toSvg(SMALL, options as unknown as ToSvgOptions)
    ).rejects.toThrow(TypeError);
  });

  it('a value that is not text, which a parsed object would be', async () => {
    await expect(toSvg(JSON.parse(SMALL) as unknown as string)).rejects.toThrow(
      new TypeError("toSvg: value is a document's JSON text")
    );
  });

  it('text that holds no document, with the parser’s own error', async () => {
    await expect(toSvg('{ not json')).rejects.toThrow(SyntaxError);
  });

  it('a realm whose document no copy of the package installed, a page’s, pointing to toImage', async () => {
    const installed = Reflect.get(globalThis, 'document');
    Reflect.set(globalThis, 'document', {});

    try {
      await expect(toSvg(SMALL)).rejects.toThrow(
        'toSvg draws where there is no document; a page draws an svg with toImage'
      );
    } finally {
      Reflect.set(globalThis, 'document', installed);
    }
  });
});

describe('what toSvg rejects once it draws', () => {
  it('an error a hook of the scene threw, which r-html logs, rather than an svg without it', async () => {
    const realm = Reflect.get(globalThis, 'document') as object;
    // Pretext lays an emoji out in a page whose body it finds, and the stub's
    // span takes no style, so the memo's hook throws as it measures.
    Reflect.deleteProperty(realm, 'body');
    const drawing = memoDocument('ship it 🚀').then(value => toSvg(value));

    try {
      await expect(drawing).rejects.toThrow(
        /^toSvg: the scene threw as it drew: .*cssText/
      );
      expect(consoleErrors).toHaveBeenCalledWith(expect.any(TypeError));
    } finally {
      Reflect.set(realm, 'body', null);
      consoleErrors.mockClear();
    }
    expect(await toSvg(SMALL)).toBe(small);
  });

  it('no line the host logs as it draws, one Error alone too, which reaches the log alone', async () => {
    const failed = new Error('a request of the host failed');

    try {
      expect(
        await drawingWith(() => {
          console.error('[host]', 'a line of the process’s own');
          console.error(new Error('logged'), 'with what it was about');
          console.error(failed);
        })
      ).toBe(small);
      expect(consoleErrors).toHaveBeenCalledWith(
        '[host]',
        'a line of the process’s own'
      );
      expect(consoleErrors).toHaveBeenCalledWith(
        expect.any(Error),
        'with what it was about'
      );
      expect(consoleErrors).toHaveBeenCalledWith(failed);
    } finally {
      consoleErrors.mockClear();
    }
  });

  it('no error a peer’s subscriber threw as it drew, which the peer logs', async () => {
    const peer = createPeerStore({ nickname: 'svg', presence: false });
    const closed = new Error('the hub socket closed');
    peer.subscribe(() => {
      throw closed;
    });

    try {
      expect(
        await drawingWith(() =>
          peer.dispatch([tableActions$.addTableAction$()])
        )
      ).toBe(small);
      expect(consoleErrors).toHaveBeenCalledWith(closed);
    } finally {
      peer.destroy();
      consoleErrors.mockClear();
    }
  });

  it('nothing of the console, which keeps what the host set as it drew', async () => {
    const spy = console.error;
    const hostLog = vi.fn();

    try {
      expect(
        await drawingWith(() => {
          console.error = hostLog;
        })
      ).toBe(small);
      expect(console.error).toBe(hostLog);
    } finally {
      console.error = spy;
    }
  });
});

/** Draws the small fixture, running side as the scene makes the container it mounts in, mid-drawing. */
async function drawingWith(side: () => void): Promise<string> {
  const realm = Reflect.get(globalThis, 'document') as {
    createElement: (tagName: string) => unknown;
  };
  const { createElement } = realm;
  realm.createElement = tagName => {
    if (tagName === 'div') side();
    return createElement(tagName);
  };

  try {
    return await toSvg(SMALL);
  } finally {
    realm.createElement = createElement;
  }
}

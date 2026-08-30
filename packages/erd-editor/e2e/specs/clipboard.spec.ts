import { expect, test } from '../support/fixtures';
import type { ErdEditorPage } from '../support/ErdEditorPage';
import {
  ColumnOption,
  ColumnUIKey,
  createSchema,
  type ErdDocument,
} from '../support/schema';

// ── mirrored from src ─────────────────────────────────────────────────────

/** utils/table-clipboard/payload.ts. */
const CLIPBOARD_MIME = 'application/x-erd-editor';
const CLIPBOARD_HTML_ATTR = 'data-erd-editor';
const CLIPBOARD_HTML_TRUNCATED_ATTR = 'data-erd-editor-truncated';

/** constants/layout.ts — the displacement of the first paste round. */
const START_ADD = 50;

/**
 * The browser's own clipboard shortcuts, not tinykeys bindings: Chromium's
 * editing layer is what turns these into copy and paste events, and Playwright
 * resolves the modifier from the same signal Chromium uses.
 */
const COPY = 'ControlOrMeta+KeyC';
const PASTE = 'ControlOrMeta+KeyV';

// ── fixtures ──────────────────────────────────────────────────────────────

/**
 * The table that gets copied. Names and comments are wider than the column
 * minimum so the recomputed widths carry information rather than the floor, and
 * a quoted name puts a character in the payload that has to survive escaping.
 */
const sourceDocument = (): ErdDocument =>
  createSchema({
    tables: [
      {
        id: 'users',
        name: 'application_users',
        comment: 'everyone who can sign in',
        x: 180,
        y: 160,
        color: '#e5484d',
        columns: [
          {
            id: 'users_id',
            name: 'id',
            dataType: 'int',
            comment: 'surrogate key',
            options:
              ColumnOption.primaryKey |
              ColumnOption.notNull |
              ColumnOption.autoIncrement,
            keys: ColumnUIKey.primaryKey,
          },
          {
            id: 'users_email',
            name: 'email',
            dataType: 'varchar(255)',
            comment: 'sign-in address',
            default: '"anon"',
            options: ColumnOption.unique | ColumnOption.notNull,
          },
          {
            id: 'users_created_at',
            name: 'created_at',
            dataType: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            options: ColumnOption.notNull,
          },
        ],
      },
    ],
  });

/**
 * The document a copied payload is pasted into: one unrelated table and nothing
 * for resolvePlacement to find. Selecting it is what makes the hard-stop cases
 * assert something, since a descending ladder would append columns to it.
 */
const targetDocument = (): ErdDocument =>
  createSchema({
    tables: [
      {
        id: 'orders',
        name: 'orders',
        x: 200,
        y: 520,
        columns: [{ id: 'orders_id', name: 'id', dataType: 'int' }],
      },
    ],
  });

// ── clipboard driving ─────────────────────────────────────────────────────

type Flavours = Record<string, string>;

type PasteRecord = {
  /** The flavours Chromium actually handed the editor. */
  types: string[];
  /** True once a handler called preventDefault() — proof the paste arrived. */
  defaultPrevented: boolean;
};

/**
 * Puts an arbitrary set of flavours on the real clipboard. The copy fires at the
 * focused element inside the editor's shadow root, so the seed is stopped at the
 * document before the editor's own handler overwrites it with the selection.
 */
async function seedClipboard(erd: ErdEditorPage, flavours: Flavours) {
  const copied = await erd.page.evaluate(entries => {
    const onCopy = (event: ClipboardEvent) => {
      event.stopPropagation();
      event.preventDefault();
      event.clipboardData?.clearData();
      for (const [type, value] of entries) {
        event.clipboardData?.setData(type, value);
      }
    };

    document.addEventListener('copy', onCopy, { once: true, capture: true });
    const ok = document.execCommand('copy');
    document.removeEventListener('copy', onCopy, true);
    return ok;
  }, Object.entries(flavours));

  if (!copied) {
    throw new Error('execCommand("copy") was refused — clipboard not seeded');
  }
}

/** Presses copy and returns the three flavours the editor wrote. */
async function copy(erd: ErdEditorPage): Promise<Flavours> {
  await erd.page.evaluate(
    types => {
      (window as any).__copied = null;
      // Bubble phase at the document, so it runs after the editor's own handler
      // and reads what that handler put on the event.
      document.addEventListener(
        'copy',
        event => {
          const data = event.clipboardData;
          (window as any).__copied = Object.fromEntries(
            types.map(type => [type, data ? data.getData(type) : ''])
          );
        },
        { once: true }
      );
    },
    ['text/plain', 'text/html', CLIPBOARD_MIME]
  );

  await erd.expectKeyboardFocusInside();
  await erd.page.keyboard.press(COPY);

  await expect
    .poll(() => erd.page.evaluate(() => (window as any).__copied))
    .not.toBeNull();

  return erd.page.evaluate(() => (window as any).__copied as Flavours);
}

/**
 * Presses paste and resolves once the event has been fully dispatched.
 * defaultPrevented is read a task later rather than inside the listener, so the
 * record does not depend on which listener ran first.
 */
async function paste(erd: ErdEditorPage): Promise<PasteRecord> {
  await erd.page.evaluate(() => {
    (window as any).__pasted = null;
    document.addEventListener(
      'paste',
      event => {
        // clipboardData empties once dispatch ends, so the types are read now
        // and only the flag is deferred.
        const types = Array.from(event.clipboardData?.types ?? []);
        setTimeout(() => {
          (window as any).__pasted = {
            types,
            defaultPrevented: event.defaultPrevented,
          };
        }, 0);
      },
      { once: true, capture: true }
    );
  });

  await erd.expectKeyboardFocusInside();
  await erd.page.keyboard.press(PASTE);

  await expect
    .poll(() => erd.page.evaluate(() => (window as any).__pasted))
    .not.toBeNull();

  return erd.page.evaluate(() => (window as any).__pasted as PasteRecord);
}

// ── payload surgery ───────────────────────────────────────────────────────

/** The visible <table> alone, with the editor's <span> wrapper stripped. */
function visibleTable(erd: ErdEditorPage, html: string) {
  return erd.page.evaluate(source => {
    const template = document.createElement('template');
    template.innerHTML = source;
    return template.content.querySelector('table')?.outerHTML ?? '';
  }, html);
}

/**
 * Rewrites the version of the JSON hidden in a text/html flavour, leaving
 * the visible table alone. Done in page context so the attribute comes back out
 * escaped exactly the way a browser writes it.
 */
function withHiddenVersion(erd: ErdEditorPage, html: string, version: number) {
  return erd.page.evaluate(
    ({ html, attr, version }) => {
      const template = document.createElement('template');
      template.innerHTML = html;

      const holder = template.content.querySelector(`[${attr}]`);
      const json = holder?.getAttribute(attr);
      if (!json) throw new Error(`the copied html carries no [${attr}]`);

      holder!.setAttribute(
        attr,
        JSON.stringify({ ...JSON.parse(json), version })
      );
      return template.innerHTML;
    },
    { html, attr: CLIPBOARD_HTML_ATTR, version }
  );
}

function withVersion(json: string, version: number) {
  return JSON.stringify({ ...JSON.parse(json), version });
}

// ── state readers ─────────────────────────────────────────────────────────

/**
 * Everything a lossless copy has to carry, minus the parts that are meant to
 * differ: ids are freshly minted and ui.x/ui.y/ui.zIndex are re-placed and
 * re-stacked, so those are asserted separately where they mean something.
 */
async function tableShape(erd: ErdEditorPage, tableId: string) {
  const { collections } = await erd.value();
  const table = collections.tableEntities[tableId];

  return {
    name: table.name,
    comment: table.comment,
    ui: {
      color: table.ui.color,
      widthName: table.ui.widthName,
      widthComment: table.ui.widthComment,
    },
    columns: table.columnIds.map(columnId => {
      const column = collections.tableColumnEntities[columnId];
      return {
        name: column.name,
        comment: column.comment,
        dataType: column.dataType,
        default: column.default,
        options: column.options,
        ui: { ...column.ui },
      };
    }),
  };
}

/** The one table id the document gained. */
async function addedTableId(erd: ErdEditorPage, before: string[]) {
  const had = new Set(before);
  const added = (await erd.tableIds()).filter(id => !had.has(id));
  expect(added).toHaveLength(1);
  return added[0];
}

/** doc and collections — what AC-27 requires to be untouched. */
async function documentSnapshot(erd: ErdEditorPage) {
  const { doc, collections } = await erd.value();
  return { doc, collections };
}

/**
 * Copies users out of a freshly seeded source document and returns both the
 * clipboard flavours and the shape the paste has to reproduce.
 */
async function copySourceTable(erd: ErdEditorPage) {
  await erd.seed(sourceDocument());
  await erd.clickTableHeader('users');
  await expect(erd.selectedTables()).toHaveCount(1);

  const shape = await tableShape(erd, 'users');
  const flavours = await copy(erd);

  expect(flavours[CLIPBOARD_MIME]).not.toBe('');
  expect(JSON.parse(flavours[CLIPBOARD_MIME]).kind).toBe('tables');

  return { flavours, shape };
}

/**
 * A full run in a freshly mounted editor: reload, seed the document, put
 * flavours on the clipboard, paste into empty canvas. The reload is what makes
 * two runs comparable, since the repeat-paste counter lives in a closure.
 */
async function pasteIntoFreshEditor(erd: ErdEditorPage, flavours: Flavours) {
  await erd.goto();
  await erd.seed(targetDocument());
  await seedClipboard(erd, flavours);
  await erd.focusCanvas();

  const record = await paste(erd);
  await expect.poll(() => erd.tableIds()).toHaveLength(2);

  const tableId = await addedTableId(erd, ['orders']);
  const { collections } = await erd.value();

  return {
    record,
    shape: await tableShape(erd, tableId),
    ui: collections.tableEntities[tableId].ui,
  };
}

test.describe('clipboard paste ladder', () => {
  // AC-17: the custom flavour on its own rebuilds the entity, every field of it.
  test('rebuilds the table from the custom flavour alone', async ({ erd }) => {
    const { flavours, shape } = await copySourceTable(erd);

    const pasted = await pasteIntoFreshEditor(erd, {
      [CLIPBOARD_MIME]: flavours[CLIPBOARD_MIME],
    });

    // Nothing but our own flavour reached the editor — the rung below never ran.
    expect(pasted.record.types).toEqual([CLIPBOARD_MIME]);
    expect(pasted.record.defaultPrevented).toBe(true);
    expect(pasted.shape).toEqual(shape);
  });

  // AC-18: a hop that drops the custom flavour still produces the identical
  // result, because the same JSON rides in a text/html attribute. Both halves
  // run in a fresh mount so the only difference between them is the channel.
  test('produces the identical result from the hidden text/html JSON', async ({
    erd,
  }) => {
    const { flavours } = await copySourceTable(erd);

    const viaCustom = await pasteIntoFreshEditor(erd, {
      [CLIPBOARD_MIME]: flavours[CLIPBOARD_MIME],
      'text/plain': flavours['text/plain'],
      'text/html': flavours['text/html'],
    });

    const viaHtml = await pasteIntoFreshEditor(erd, {
      'text/plain': flavours['text/plain'],
      'text/html': flavours['text/html'],
    });

    expect(viaHtml.record.types).not.toContain(CLIPBOARD_MIME);
    expect(viaHtml.record.types).toContain('text/html');
    expect(viaHtml.shape).toEqual(viaCustom.shape);
    // Placement included: the same payload has to land in the same place.
    expect(viaHtml.ui).toEqual(viaCustom.ui);
  });

  // The control for the two hard stops below: the same table the editor wrote
  // with the wrapper stripped is somebody else's html, so the ladder descends
  // and merges it. The marker on the wrapper decides, and nothing else.
  test("merges a stranger's html table into the selected table", async ({
    erd,
  }) => {
    const { flavours } = await copySourceTable(erd);
    const table = await visibleTable(erd, flavours['text/html']);
    expect(table).not.toBe('');

    await erd.seed(targetDocument());
    await seedClipboard(erd, { 'text/html': table });
    await erd.clickTableHeader('orders');

    const record = await paste(erd);
    expect(record.defaultPrevented).toBe(true);

    await expect.poll(() => erd.columnIds('orders')).toHaveLength(4);
    expect(await erd.tableIds()).toEqual(['orders']);

    const appended = (await erd.columnIds('orders')).slice(1);
    const names = await Promise.all(
      appended.map(async id => (await erd.column(id)).name)
    );
    expect(names).toEqual(['id', 'email', 'created_at']);
  });

  // A payload from a release that has not shipped yet. The version check has to
  // stop the ladder dead, because the rung below is the html table we wrote
  // ourselves, which parses cleanly and would append to the selection.
  test('hard stops on a payload from a newer version', async ({ erd }) => {
    const { flavours } = await copySourceTable(erd);

    await erd.seed(targetDocument());
    await seedClipboard(erd, {
      [CLIPBOARD_MIME]: withVersion(flavours[CLIPBOARD_MIME], 999),
      'text/plain': flavours['text/plain'],
      'text/html': await withHiddenVersion(erd, flavours['text/html'], 999),
    });
    await erd.clickTableHeader('orders');

    const before = await documentSnapshot(erd);
    const record = await paste(erd);

    expect(record.types).toContain(CLIPBOARD_MIME);
    // The stop is a preventDefault() with no dispatch, so the flag is the only
    // signal that the handler ran at all rather than the event going missing.
    expect(record.defaultPrevented).toBe(true);

    // Long enough for the control above to have finished merging three columns.
    await erd.page.waitForTimeout(500);
    expect(await documentSnapshot(erd)).toEqual(before);
  });

  // The copy was too large for the hidden JSON and the hop dropped the custom
  // flavour, leaving our own visible table plus the marker saying the JSON used
  // to be there, which is the whole reason the marker exists.
  test('hard stops on a truncated payload with no hidden JSON', async ({
    erd,
  }) => {
    const { flavours } = await copySourceTable(erd);
    const table = await visibleTable(erd, flavours['text/html']);

    await erd.seed(targetDocument());
    await seedClipboard(erd, {
      'text/plain': flavours['text/plain'],
      'text/html': `<span ${CLIPBOARD_HTML_TRUNCATED_ATTR}="1">${table}</span>`,
    });
    await erd.clickTableHeader('orders');

    const before = await documentSnapshot(erd);
    const record = await paste(erd);

    expect(record.types).not.toContain(CLIPBOARD_MIME);
    expect(record.defaultPrevented).toBe(true);

    await erd.page.waitForTimeout(500);
    expect(await documentSnapshot(erd)).toEqual(before);
  });

  // AC-8 / AC-17: copy and paste inside one document, over the real clipboard.
  // The widths are the part only a browser can check — they are recomputed from
  // a text measurement on both sides, never carried across.
  test('round trips a table through the real clipboard', async ({ erd }) => {
    const { shape } = await copySourceTable(erd);
    const original = await erd.table('users');

    const record = await paste(erd);
    expect(record.types).toEqual(['text/plain', 'text/html', CLIPBOARD_MIME]);
    await expect.poll(() => erd.tableIds()).toHaveLength(2);

    const copyId = await addedTableId(erd, ['users']);
    const copy = await erd.table(copyId);

    expect(await tableShape(erd, copyId)).toEqual(shape);
    expect(copy.ui.x).toBe(original.ui.x + START_ADD);
    expect(copy.ui.y).toBe(original.ui.y + START_ADD);
    // Re-stacked rather than restored: the copy has to sit above what is there.
    expect(copy.ui.zIndex).toBeGreaterThan(original.ui.zIndex);

    // The original is left exactly as it was — no columns appended to it.
    expect(await tableShape(erd, 'users')).toEqual(shape);
    expect((await erd.table('users')).ui).toEqual(original.ui);
  });
});

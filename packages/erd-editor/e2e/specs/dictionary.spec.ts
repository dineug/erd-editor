import { readFile } from 'node:fs/promises';

import type { Locator } from '@playwright/test';

import type { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { createSchema, type ErdDocument } from '../support/schema';
import { Shortcut } from '../support/shortcuts';

// The Dictionary tab in the real element: three CSV files picked in the file
// dialog its Import CSV opens, one undo per file on its own sheet, the column
// chords on rows, the files Export CSV saves, and a check's double click.

type Sheet = 'word' | 'term' | 'domain';

/**
 * A sample file as the editor writes one, a byte order mark first and a CRLF
 * after each record, with the sheet it fills and its button's label.
 */
function sample(
  sheet: Sheet,
  label: string,
  header: string,
  ...records: string[]
) {
  const text = `\uFEFF${[header, ...records].map(line => `${line}\r\n`).join('')}`;
  return {
    sheet,
    label,
    name: `${sheet}s.csv`,
    header,
    rows: records.length,
    text,
  };
}

/** The domains, one type quoted for its comma and one description for its own. */
const DOMAINS = sample(
  'domain',
  'Domains',
  'name,category,dataType,description',
  'Name,Text,VARCHAR(100),',
  'Number,Number,INT,',
  'Amount,Number,"NUMERIC(15,2)","Money, two decimal places"'
);

/** The words, one description holding quotes, which a file doubles. */
const WORDS = sample(
  'word',
  'Words',
  'name,abbreviation,englishName,description,synonyms,forbiddenWords',
  'Customer,CUST,Customer,One who buys,Client,',
  'Name,NM,Name,"Shown as ""N/A"" when empty",,',
  'Number,NO,Number,,,',
  'Order,ORD,Order,,,',
  'Amount,AMT,Amount,,,'
);

/** The terms, each naming its domain by name, which only a domain imported first resolves. */
const TERMS = sample(
  'term',
  'Terms',
  'name,physicalName,domain,description,synonyms',
  'Customer Name,CUST_NM,Name,,',
  'Customer Number,CUST_NO,Number,,',
  'Order Number,ORD_NO,Number,,',
  'Order Amount,ORD_AMT,Amount,"The total, tax included",'
);

/** Where the runtime value keeps a dictionary's order and its rows. */
const STORED = {
  word: { ids: 'wordIds', rows: 'wordEntities' },
  term: { ids: 'termIds', rows: 'termEntities' },
  domain: { ids: 'domainIds', rows: 'domainEntities' },
} as const;

/** The grid's column header and each row below it are 28 px tall. */
const ROW_HEIGHT = 28;

const tabOf = (erd: ErdEditorPage) => erd.host.locator('.dictionary');

const tabButton = (erd: ErdEditorPage, name: string) =>
  tabOf(erd).getByRole('button', { name, exact: true });

/** The name on the sheet button the tab shows pressed, without its count. */
const shownSheet = (erd: ErdEditorPage) =>
  tabOf(erd)
    .getByRole('group', { name: 'Dictionary' })
    .getByRole('button', { pressed: true })
    .locator('span')
    .first();

/** The status line's row count: the rows the sheet shown lists under its search. */
const rowCount = (erd: ErdEditorPage, count: number) =>
  tabOf(erd).getByText(`${count} ${count === 1 ? 'row' : 'rows'}`, {
    exact: true,
  });

const toast = (erd: ErdEditorPage, text: string) =>
  erd.host.locator('.toast-container', { hasText: text });

/** A sheet's listed rows as the runtime value holds them, in their order, each by its field names. */
async function listedRows(erd: ErdEditorPage, sheet: Sheet) {
  const { doc, collections } = await erd.value();
  const stored = collections[STORED[sheet].rows];
  const byId = new Map(
    (stored?.rows ?? []).map(values => {
      const row = Object.fromEntries(
        stored!.fields.map((field, at) => [field, String(values[at])])
      );
      return [row.id, row];
    })
  );

  return (doc[STORED[sheet].ids] ?? []).map(id => byId.get(id)!);
}

/** Each sheet's row count, read where the document keeps it. */
const countsOf = async (erd: ErdEditorPage) => ({
  domain: (await listedRows(erd, 'domain')).length,
  word: (await listedRows(erd, 'word')).length,
  term: (await listedRows(erd, 'term')).length,
});

async function openTab(erd: ErdEditorPage) {
  await erd.toolbarButton('Dictionary').click();
  await expect(shownSheet(erd)).toHaveText('Words');
}

/** Import CSV, then the file handed to the dialog it opens, as a reader picks one. */
async function importCsv(erd: ErdEditorPage, file: typeof WORDS) {
  const chooser = erd.page.waitForEvent('filechooser');
  await tabButton(erd, 'Import CSV').click();
  await (
    await chooser
  ).setFiles({
    name: file.name,
    mimeType: 'text/csv',
    buffer: Buffer.from(file.text),
  });
}

/** The three files in the order a document takes them, since a term reads its domain. */
async function importAll(erd: ErdEditorPage) {
  for (const file of [DOMAINS, WORDS, TERMS]) {
    await importCsv(erd, file);
    await expect(shownSheet(erd)).toHaveText(file.label);
    await expect(rowCount(erd, file.rows)).toBeVisible();
    await expect(
      toast(erd, `${file.rows} added · 0 updated · 0 skipped`)
    ).toBeVisible();
  }
}

/** Export CSV on the sheet shown, and the file the browser receives. */
async function exportCsv(erd: ErdEditorPage) {
  const download = erd.page.waitForEvent('download');
  await tabButton(erd, 'Export CSV').click();
  const file = await download;
  return {
    name: file.suggestedFilename(),
    bytes: await readFile(await file.path()),
  };
}

/** A double click at the middle of a body row, in the grid's first column. */
async function doubleClickRow(scroller: Locator, row: number) {
  await scroller.dblclick({
    position: { x: 100, y: ROW_HEIGHT + row * ROW_HEIGHT + ROW_HEIGHT / 2 },
  });
}

test.describe('the Dictionary tab', () => {
  test('imports the domains, the words and the terms in that order, each file taken back by one undo of its own sheet', async ({
    erd,
  }) => {
    await erd.seed(createSchema({ databaseName: 'shop' }));
    await openTab(erd);

    await importAll(erd);
    expect(await countsOf(erd)).toEqual({ domain: 3, word: 5, term: 4 });

    // A term's domain is the id of the domain its file named, which the
    // document held only because the domains came first.
    const domainIds = Object.fromEntries(
      (await listedRows(erd, 'domain')).map(({ id, name }) => [name, id])
    );
    expect(
      (await listedRows(erd, 'term')).map(({ name, domainId }) => [
        name,
        domainId,
      ])
    ).toEqual([
      ['Customer Name', domainIds.Name],
      ['Customer Number', domainIds.Number],
      ['Order Number', domainIds.Number],
      ['Order Amount', domainIds.Amount],
    ]);

    // The same file again changes no row, so it leaves nothing to undo.
    await importCsv(erd, WORDS);
    await expect(shownSheet(erd)).toHaveText('Words');
    await expect(toast(erd, '0 added · 0 updated · 0 skipped')).toBeVisible();

    // The import left the keyboard in the sheet's grid, where the tab runs
    // undo itself, on the history of the sheet shown alone.
    await erd.press(Shortcut.undo);
    await expect
      .poll(() => countsOf(erd))
      .toEqual({ domain: 3, word: 0, term: 4 });
    await expect(rowCount(erd, 0)).toBeVisible();
    await expect(
      tabOf(erd).getByText('Import a CSV file or add a row', { exact: true })
    ).toBeVisible();
    await expect(erd.toolbarButton('Undo')).not.toHaveClass(/\bactive\b/);

    // Each other sheet keeps its own file, which the toolbar's Undo takes back.
    for (const [sheet, counts] of [
      ['Terms', { domain: 3, word: 0, term: 0 }],
      ['Domains', { domain: 0, word: 0, term: 0 }],
    ] as const) {
      await tabButton(erd, sheet).click();
      await expect(shownSheet(erd)).toHaveText(sheet);
      await erd.undo();
      await expect.poll(() => countsOf(erd)).toEqual(counts);
    }

    // The ERD tab, whose history holds no dictionary edit, has none to undo.
    await erd.toolbarButton('Entity Relationship Diagram').click();
    await expect(erd.toolbarButton('Undo')).toBeVisible();
    await expect(erd.toolbarButton('Undo')).not.toHaveClass(/\bactive\b/);
  });

  test('inserts as many rows below the selection as it covers on Alt+Enter and deletes them on Alt+Delete, as the column chords do on the ERD tab', async ({
    erd,
  }) => {
    await erd.seed(createSchema({ databaseName: 'shop' }));
    await openTab(erd);
    await importCsv(erd, WORDS);
    await expect(rowCount(erd, WORDS.rows)).toBeVisible();

    await tabOf(erd)
      .locator('.dineug-grid-scroller')
      .click({ position: { x: 100, y: ROW_HEIGHT + ROW_HEIGHT / 2 } });
    await erd.page.keyboard.press('Shift+ArrowDown');
    await erd.page.keyboard.press('Alt+Enter');
    await expect(rowCount(erd, WORDS.rows + 2)).toBeVisible();
    await expect(
      tabOf(erd).getByText('2 selected', { exact: true })
    ).toBeVisible();

    // Delete takes the two new rows the insert left selected, no word of the file.
    const imported = (await listedRows(erd, 'word')).map(({ name }) => name);
    await erd.page.keyboard.press('Alt+Delete');
    await expect(rowCount(erd, WORDS.rows)).toBeVisible();
    expect((await listedRows(erd, 'word')).map(({ name }) => name)).toEqual(
      imported.filter(name => name !== '')
    );
  });

  test('inserts as many rows above the selection as it covers on Alt+Shift+Enter, the add chord with Shift held', async ({
    erd,
  }) => {
    await erd.seed(createSchema({ databaseName: 'shop' }));
    await openTab(erd);
    await importCsv(erd, WORDS);
    await expect(rowCount(erd, WORDS.rows)).toBeVisible();

    // The sheet's order is each row's order key, compared in code unit order.
    const sheetNames = async () =>
      (await listedRows(erd, 'word'))
        .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
        .map(({ name }) => name);
    const imported = await sheetNames();

    await tabOf(erd)
      .locator('.dineug-grid-scroller')
      .click({ position: { x: 100, y: ROW_HEIGHT + ROW_HEIGHT / 2 } });
    await erd.page.keyboard.press('Shift+ArrowDown');
    await erd.page.keyboard.press('Alt+Shift+Enter');
    await expect(rowCount(erd, WORDS.rows + 2)).toBeVisible();
    expect(await sheetNames()).toEqual(['', '', ...imported]);
  });

  test('saves each sheet whole as the bytes its file came in: a byte order mark, the header and CRLF', async ({
    erd,
  }) => {
    await erd.seed(createSchema({ databaseName: 'shop' }));
    await openTab(erd);
    await importAll(erd);

    // A search narrows what the sheet shows, never what it saves.
    await tabButton(erd, 'Words').click();
    await tabOf(erd).getByPlaceholder('Search').fill('cust');
    await expect(rowCount(erd, 1)).toBeVisible();

    for (const file of [WORDS, TERMS, DOMAINS]) {
      await tabButton(erd, file.label).click();
      await expect(shownSheet(erd)).toHaveText(file.label);

      const saved = await exportCsv(erd);
      expect(saved.name).toMatch(
        new RegExp(
          `^shop-\\d{4}-\\d\\d-\\d\\dT\\d\\d_\\d\\d_\\d\\d-${file.sheet}s\\.csv$`
        )
      );
      expect([...saved.bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

      const text = saved.bytes.toString('utf8');
      expect(text.startsWith(`\uFEFF${file.header}\r\n`)).toBe(true);
      expect(text.split('\r\n')).toHaveLength(file.rows + 2);
      expect(text).not.toMatch(/[^\r]\n/);
      expect(saved.bytes.equals(Buffer.from(file.text))).toBe(true);
    }
  });

  test("goes from a column's check to that column's name on the ERD tab, the canvas taking the keyboard", async ({
    erd,
  }) => {
    await erd.seed(customers());
    await openTab(erd);
    await tabButton(erd, 'Checks').click();
    await expect(shownSheet(erd)).toHaveText('Checks');

    // A table's checks list before its columns', in their order, so the
    // phone's unregistered word is the second row.
    await expect(rowCount(erd, 3)).toBeVisible();
    await doubleClickRow(tabOf(erd).locator('.dineug-grid-scroller'), 1);

    await expect
      .poll(async () => (await erd.settings()).canvasType)
      .toBe('ERD');
    await expect(tabOf(erd)).toHaveCount(0);
    await expect
      .poll(() => erd.focusRingCells())
      .toEqual(['customers_phone:columnName']);
    await expect(erd.tableEl('customers')).toHaveAttribute('data-selected');
    await erd.expectKeyboardFocusInside();
    await expect(erd.editInput()).toHaveCount(0);

    await erd.press(Shortcut.edit);
    await expect(erd.editInput()).toHaveValue('CUST_PHONE');
  });
});

/**
 * One table whose logical names hold a word the word sheet lacks: its own and
 * two of its three columns', each an unregistered word on the check sheet.
 */
function customers(): ErdDocument {
  return createSchema({
    tables: [
      {
        id: 'customers',
        name: 'customers',
        logicalName: 'Customer Info',
        x: 200,
        y: 200,
        columns: [
          {
            id: 'customers_name',
            name: 'CUST_NM',
            logicalName: 'Customer Name',
            dataType: 'VARCHAR(100)',
          },
          {
            id: 'customers_phone',
            name: 'CUST_PHONE',
            logicalName: 'Customer Phone',
            dataType: 'VARCHAR(20)',
          },
          {
            id: 'customers_email',
            name: 'CUST_EMAIL',
            logicalName: 'Customer Email',
            dataType: 'VARCHAR(255)',
          },
        ],
      },
    ],
    words: [
      { id: 'word_customer', name: 'Customer', abbreviation: 'CUST' },
      { id: 'word_name', name: 'Name', abbreviation: 'NM' },
    ],
  });
}

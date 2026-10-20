import type { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import {
  ColumnOption,
  createSchema,
  DEFAULT_SHOW,
  type SchemaSeed,
  Show,
  UNLOCK_NAME_VIEW,
} from '../support/schema';
import { Shortcut } from '../support/shortcuts';

// The name views and the dictionaries in the real element: the switch from the
// canvas menu and the palette, the term list under a logical name, a name typed
// by hand that no logical name rewrites, and the command that derives it again.

const TABLE = 'customers';
/** A column whose name, domain and type its term gave it. */
const DERIVED = 'customers_name';
/** A column with no name of either kind yet. */
const BLANK = 'customers_blank';

/**
 * One table over the three dictionaries, its name view unlocked so a switch
 * reaches the runtime value. Two terms start alike, so a few letters list
 * both, and the words compose a name for a logical name no term holds.
 */
function customers(seed: Pick<SchemaSeed, 'nameViewMode' | 'lockSettings'>) {
  return createSchema({
    lockSettings: UNLOCK_NAME_VIEW,
    ...seed,
    show: DEFAULT_SHOW | Show.columnDomain,
    tables: [
      {
        id: TABLE,
        name: 'customers',
        logicalName: 'Customer',
        x: 200,
        y: 200,
        columns: [
          {
            id: DERIVED,
            name: 'CUST_NM',
            logicalName: 'Customer Name',
            domainId: 'domain_name',
            dataType: 'VARCHAR(100)',
            options: ColumnOption.nameDerived,
          },
          { id: BLANK },
        ],
      },
    ],
    words: [
      { id: 'word_customer', name: 'Customer', abbreviation: 'CUST' },
      { id: 'word_name', name: 'Name', abbreviation: 'NM' },
      { id: 'word_number', name: 'Number', abbreviation: 'NO' },
      { id: 'word_order', name: 'Order', abbreviation: 'ORD' },
      { id: 'word_date', name: 'Date', abbreviation: 'DT' },
    ],
    terms: [
      {
        id: 'term_customer_name',
        name: 'Customer Name',
        physicalName: 'CUST_NM',
        domainId: 'domain_name',
      },
      {
        id: 'term_customer_number',
        name: 'Customer Number',
        physicalName: 'CUST_NO',
        domainId: 'domain_number',
      },
    ],
    domains: [
      { id: 'domain_name', name: 'Name', dataType: 'VARCHAR(100)' },
      { id: 'domain_number', name: 'Number', dataType: 'INT' },
    ],
  });
}

/** One cell of the table's header, by the focus it takes. */
const headerCell = (erd: ErdEditorPage, type: string) =>
  erd.cell(erd.tableEl(TABLE), type);

/** One cell of a column's row, by the focus it takes. */
const rowCell = (erd: ErdEditorPage, columnId: string, type: string) =>
  erd.cell(erd.columnEl(columnId), type);

/** The rows of the term list under the open logical name editor; a row's first span holds its name. */
const termRows = (erd: ErdEditorPage) =>
  erd.host.locator('.edit-overlay .logical-name-hint-item');

/** What the dictionaries write into a column, read back from the runtime value. */
async function namesOf(erd: ErdEditorPage, columnId: string) {
  const column = await erd.column(columnId);
  return {
    name: column.name,
    logicalName: column.logicalName ?? '',
    domainId: column.domainId ?? '',
    dataType: column.dataType,
    derived: (column.options & ColumnOption.nameDerived) !== 0,
  };
}

const nameViewOf = async (erd: ErdEditorPage) =>
  (await erd.settings()).nameViewMode ?? 'physical';

/** Name View in the canvas menu over bare canvas, then one of its views. */
async function pickFromMenu(erd: ErdEditorPage, view: string) {
  await erd.clickAt(await erd.emptyPoint(), { button: 'right' });
  await erd.contextMenu.getByText('Name View', { exact: true }).hover();
  await erd.contextMenu.nth(1).getByText(view, { exact: true }).click();
}

test.describe('name views', () => {
  test('switches between the three views from the canvas menu and the palette', async ({
    erd,
    page,
  }) => {
    await erd.seed(customers({}));

    await expect(headerCell(erd, 'tableName')).toHaveText('customers');
    await expect(headerCell(erd, 'tableLogicalName')).toHaveCount(0);
    await expect(rowCell(erd, DERIVED, 'columnName')).toHaveText('CUST_NM');
    await expect(rowCell(erd, DERIVED, 'columnLogicalName')).toHaveCount(0);

    await pickFromMenu(erd, 'Logical Names');

    // The logical name stands in each name's place, and the type keeps its
    // own cell while the domain has one.
    await expect(headerCell(erd, 'tableLogicalName')).toHaveText('Customer');
    await expect(headerCell(erd, 'tableName')).toHaveCount(0);
    await expect(rowCell(erd, DERIVED, 'columnLogicalName')).toHaveText(
      'Customer Name'
    );
    await expect(rowCell(erd, DERIVED, 'columnName')).toHaveCount(0);
    await expect(rowCell(erd, DERIVED, 'columnDataType')).toHaveText(
      'VARCHAR(100)'
    );
    await expect(rowCell(erd, DERIVED, 'columnDomain')).toHaveText('Name');
    await expect.poll(() => nameViewOf(erd)).toBe('logical');

    const palette = erd.host.locator('.quick-search');
    await erd.focusCanvas();
    await erd.press(Shortcut.search);
    await page.keyboard.type('Name View');
    await palette.getByText('Name View', { exact: true }).click();
    await palette.getByText('Both Names', { exact: true }).click();
    await expect(palette).toHaveCount(0);

    await expect(headerCell(erd, 'tableLogicalName')).toHaveText('Customer');
    await expect(headerCell(erd, 'tableName')).toHaveText('customers');
    await expect(rowCell(erd, DERIVED, 'columnLogicalName')).toHaveText(
      'Customer Name'
    );
    await expect(rowCell(erd, DERIVED, 'columnName')).toHaveText('CUST_NM');
    await expect.poll(() => nameViewOf(erd)).toBe('both');

    await pickFromMenu(erd, 'Physical Names');
    await expect(headerCell(erd, 'tableLogicalName')).toHaveCount(0);
    await expect(rowCell(erd, DERIVED, 'columnName')).toHaveText('CUST_NM');
    await expect.poll(() => nameViewOf(erd)).toBe('physical');
  });

  test('switches only the view on screen while the name view is locked', async ({
    erd,
  }) => {
    await erd.seed(customers({ lockSettings: 0 }));

    await pickFromMenu(erd, 'Logical Names');

    await expect(headerCell(erd, 'tableLogicalName')).toHaveText('Customer');
    await expect(rowCell(erd, DERIVED, 'columnLogicalName')).toHaveText(
      'Customer Name'
    );
    // A locked setting is written at its lock, so the file keeps physical.
    expect(await nameViewOf(erd)).toBe('physical');
  });
});

test.describe('logical names under the dictionaries', () => {
  test('fills the name and the domain from the term picked in the list, in one undo', async ({
    erd,
    page,
  }) => {
    await erd.seed(customers({ nameViewMode: 'both' }));

    await erd.editCell(rowCell(erd, BLANK, 'columnLogicalName'), 'cust');
    await expect(termRows(erd).locator(':scope > span')).toHaveText([
      'Customer Name',
      'Customer Number',
    ]);

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(
      erd.host.locator('.edit-overlay .logical-name-hint-item.selected')
    ).toHaveText(/Customer Number/);
    await page.keyboard.press('Enter');

    await expect(erd.editInput()).toHaveCount(0);
    await expect
      .poll(() => namesOf(erd, BLANK))
      .toEqual({
        name: 'CUST_NO',
        logicalName: 'Customer Number',
        domainId: 'domain_number',
        dataType: 'INT',
        derived: true,
      });
    await expect(rowCell(erd, BLANK, 'columnLogicalName')).toHaveText(
      'Customer Number'
    );
    await expect(rowCell(erd, BLANK, 'columnName')).toHaveText('CUST_NO');
    await expect(rowCell(erd, BLANK, 'columnDataType')).toHaveText('INT');
    await expect(rowCell(erd, BLANK, 'columnDomain')).toHaveText('Number');

    // The pick is one dispatch, so one undo leaves the letters typed before it.
    await erd.undo();
    await expect
      .poll(() => namesOf(erd, BLANK))
      .toEqual({
        name: '',
        logicalName: 'cust',
        domainId: '',
        dataType: '',
        derived: false,
      });
  });

  test('composes the name from the words as the editor closes on a logical name no term holds', async ({
    erd,
    page,
  }) => {
    await erd.seed(customers({ nameViewMode: 'both' }));

    await erd.editCell(rowCell(erd, BLANK, 'columnLogicalName'), 'Order Date');
    await expect(termRows(erd)).toHaveCount(0);
    // Each key wrote the logical name alone; the name waits for the close.
    await expect
      .poll(() => namesOf(erd, BLANK))
      .toEqual({
        name: '',
        logicalName: 'Order Date',
        domainId: '',
        dataType: '',
        derived: false,
      });

    await page.keyboard.press('Enter');

    await expect(erd.editInput()).toHaveCount(0);
    await expect
      .poll(() => namesOf(erd, BLANK))
      .toEqual({
        name: 'ORD_DT',
        logicalName: 'Order Date',
        domainId: '',
        dataType: '',
        derived: true,
      });
    await expect(rowCell(erd, BLANK, 'columnName')).toHaveText('ORD_DT');
  });

  test('keeps a name typed by hand through the next logical name until it is derived again', async ({
    erd,
    page,
  }) => {
    await erd.seed(customers({ nameViewMode: 'both' }));

    await erd.editCell(rowCell(erd, DERIVED, 'columnName'), 'customer_label');
    await erd.press(Shortcut.stop);
    await expect(erd.editInput()).toHaveCount(0);
    await expect
      .poll(() => namesOf(erd, DERIVED))
      .toEqual({
        name: 'customer_label',
        logicalName: 'Customer Name',
        domainId: 'domain_name',
        dataType: 'VARCHAR(100)',
        derived: false,
      });

    await erd.editCell(
      rowCell(erd, DERIVED, 'columnLogicalName'),
      'Customer Number'
    );
    await expect(termRows(erd)).toHaveCount(1);
    // The first Escape closes the list alone, the second the editor.
    await page.keyboard.press('Escape');
    await expect(termRows(erd)).toHaveCount(0);
    await expect(erd.editInput()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(erd.editInput()).toHaveCount(0);

    const typed = {
      name: 'customer_label',
      logicalName: 'Customer Number',
      domainId: 'domain_name',
      dataType: 'VARCHAR(100)',
      derived: false,
    };
    await expect.poll(() => namesOf(erd, DERIVED)).toEqual(typed);
    await expect(rowCell(erd, DERIVED, 'columnName')).toHaveText(
      'customer_label'
    );

    // The press on the row reaches that column alone.
    await erd.clickAt(await erd.columnPoint(DERIVED), { button: 'right' });
    await erd.contextMenuItem('Derive Physical Name Again').click();

    const rederived = {
      name: 'CUST_NO',
      logicalName: 'Customer Number',
      domainId: 'domain_number',
      dataType: 'INT',
      derived: true,
    };
    await expect.poll(() => namesOf(erd, DERIVED)).toEqual(rederived);
    await expect(rowCell(erd, DERIVED, 'columnName')).toHaveText('CUST_NO');
    await expect(rowCell(erd, DERIVED, 'columnDomain')).toHaveText('Number');
    expect((await erd.table(TABLE)).name).toBe('customers');

    await erd.undo();
    await expect.poll(() => namesOf(erd, DERIVED)).toEqual(typed);

    // The palette's whole document reaches the table's own name too.
    const palette = erd.host.locator('.quick-search');
    await erd.focusCanvas();
    await erd.press(Shortcut.search);
    await page.keyboard.type('whole document');
    await palette
      .locator('.quick-search-row', { hasText: 'whole document' })
      .getByText('Derive Physical Names Again', { exact: true })
      .click();
    await expect(palette).toHaveCount(0);

    await expect.poll(() => namesOf(erd, DERIVED)).toEqual(rederived);
    await expect
      .poll(async () => {
        const table = await erd.table(TABLE);
        return [table.name, table.nameDerived ?? false];
      })
      .toEqual(['CUST', true]);
    await expect(headerCell(erd, 'tableName')).toHaveText('CUST');
  });
});

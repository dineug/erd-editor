import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vitest';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import Shortcuts from '@/components/settings/shortcuts/Shortcuts';
import * as styles from '@/components/settings/shortcuts/Shortcuts.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const EXPECTED_COMMANDS = [
  'Editing',
  'Stop',
  'Search',
  'Undo',
  'Redo',
  'Add Table',
  'Add Column',
  'Add Memo',
  'Remove Table, Memo',
  'Remove Column',
  'Primary Key',
  'Select All Table, Memo',
  'Select All Column',
  'Relationship Zero One',
  'Relationship Zero N',
  'Relationship One Only',
  'Relationship One N',
  'Table Properties',
  'Zoom In',
  'Zoom Out',
];

const table = () =>
  mounted!.container.querySelector(`.${styles.table}`) as HTMLTableElement;

const rows = () =>
  Array.from<HTMLTableRowElement>(table().querySelectorAll('tbody tr'));

const rowByCommand = (command: string) =>
  rows().find(
    row => row.querySelector('td')?.textContent?.trim() === command
  ) as HTMLTableRowElement;

async function setup() {
  mounted = await mountAndFlush(html`<${Shortcuts} />`);
  return mounted;
}

describe('Shortcuts', () => {
  it('renders a two column table headed Command / Keybinding', async () => {
    await setup();

    const headers = Array.from<HTMLTableCellElement>(
      table().querySelectorAll('thead th')
    );

    expect(table()).toBeTruthy();
    expect(headers.map(th => th.textContent?.trim())).toEqual([
      'Command',
      'Keybinding',
    ]);
  });

  it('lists every keyBindingMap command in a fixed order', async () => {
    await setup();

    expect(rows()).toHaveLength(EXPECTED_COMMANDS.length);
    expect(
      rows().map(row => row.querySelector('td')?.textContent?.trim())
    ).toEqual(EXPECTED_COMMANDS);
  });

  it('renders one shortcut group per bound shortcut', async () => {
    const { app } = await setup();

    const editRow = rowByCommand('Editing');
    expect(editRow.querySelectorAll(`.${styles.shortcutGroup}`)).toHaveLength(
      app.keyBindingMap.edit.length
    );

    // `removeTable` is bound twice ($mod+Backspace and $mod+Delete).
    const removeRow = rowByCommand('Remove Table, Memo');
    expect(app.keyBindingMap.removeTable.length).toBe(2);
    expect(removeRow.querySelectorAll(`.${styles.shortcutGroup}`)).toHaveLength(
      2
    );
  });

  it('renders each shortcut through the Kbd primitive', async () => {
    await setup();

    const editRow = rowByCommand('Editing');
    const kbd = editRow.querySelector('.kbd') as HTMLDivElement;

    expect(kbd).toBeTruthy();
    expect(kbd.textContent?.trim()).toBe('Enter');

    const stopRow = rowByCommand('Stop');
    expect(stopRow.querySelector('.kbd')?.textContent?.trim()).toBe('ESC');
  });

  it('renders modifier combinations joined with +', async () => {
    await setup();

    const undoRow = rowByCommand('Undo');
    const text = undoRow.textContent ?? '';

    expect(text).toContain('+');
    expect(text).toContain('Z');
  });

  it('re-renders when the app keyBindingMap is replaced', async () => {
    const { app } = await setup();

    app.keyBindingMap.addTable = [
      { shortcut: 'Alt+KeyQ', preventDefault: true },
      { shortcut: 'Alt+KeyW', preventDefault: true },
    ];
    await flush();

    const addTableRow = rowByCommand('Add Table');
    expect(
      addTableRow.querySelectorAll(`.${styles.shortcutGroup}`)
    ).toHaveLength(2);
    expect(addTableRow.textContent).toContain('Q');
    expect(addTableRow.textContent).toContain('W');
  });

  it('renders an empty keybinding cell when a command has no shortcut', async () => {
    const { app } = await setup();

    app.keyBindingMap.zoomIn = [];
    await flush();

    const zoomInRow = rowByCommand('Zoom In');
    const cells = zoomInRow.querySelectorAll('td');

    expect(cells).toHaveLength(2);
    expect(zoomInRow.querySelectorAll(`.${styles.shortcutGroup}`)).toHaveLength(
      0
    );
  });
});

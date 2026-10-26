// A readonly editor's Schema SQL tab in a real element over a document whose
// locks are off: the database and the bracket picked rewrite the DDL on this
// screen alone, the scripts stay read only, and a copy takes what it shows.

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import {
  closeReadonlyEditors,
  drawn,
  openReadonlyEditor,
  READONLY_SEED_SETTINGS,
  type ReadonlyEditor,
} from '@/__test-utils__/readonlyEditor';
import * as styles from '@/components/schema-sql/SchemaSQL.styles';
import { BracketType, Database } from '@/constants/schema';
import { setExportFileCallback } from '@/utils/file/exportFile';

// The code block's highlighter is a shared worker whose shiki modules the dev
// server would discover mid-run and reload every spec for; plain text will do.
vi.mock('@/services/shiki', () => ({ getShikiService: () => null }));

afterEach(() => {
  closeReadonlyEditors();
  setExportFileCallback(null);
  vi.restoreAllMocks();
});

/** The code block drops the trailing blank line, which a copy keeps. */
const shownAs = (code: string) => code.replace(/\n+$/, '');

const codeOf = ({ shadow }: ReadonlyEditor) =>
  shadow.querySelector<HTMLTextAreaElement>(`.${String(styles.code)} textarea`)!
    .value;

const panelOf = ({ shadow }: ReadonlyEditor) =>
  shadow.querySelector<HTMLElement>('.schema-sql-options')!;

/** Picks a value in one of the panel's lists, as a reader's pick fires its change. */
async function choose(editor: ReadonlyEditor, id: string, value: number) {
  const select = panelOf(editor).querySelector<HTMLSelectElement>(`#${id}`)!;
  select.value = String(value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await drawn();
}

const documentSettings = ({ el }: ReadonlyEditor) => {
  const { database, bracketType } = JSON.parse(el.value).settings;
  return { database, bracketType };
};

const SEED = {
  database: READONLY_SEED_SETTINGS.database,
  bracketType: READONLY_SEED_SETTINGS.bracketType,
};

/** Presses every segment of the panel's group its caption id names, in order. */
async function pressSegments(editor: ReadonlyEditor, captionId: string) {
  const segments = panelOf(editor).querySelectorAll<HTMLElement>(
    `[aria-labelledby="${captionId}"] button`
  );
  for (const segment of segments) await userEvent.click(segment);
  await drawn();
}

describe("a readonly editor's Schema SQL tab over a document with its locks off", () => {
  it('rewrites the DDL on this screen for the database and the bracket, the document and a peer keeping theirs', async () => {
    const editor = await openReadonlyEditor();
    await editor.openTab('Schema SQL');
    const opened = codeOf(editor);
    expect(opened).toContain('USE shop;');

    await choose(editor, 'schema-sql-database', Database.PostgreSQL);
    const postgres = codeOf(editor);
    expect(postgres).toContain('SET search_path TO shop, public;');
    expect(postgres).not.toContain('USE shop;');
    expect(documentSettings(editor)).toEqual(SEED);

    await choose(editor, 'schema-sql-bracket', BracketType.doubleQuote);
    expect(codeOf(editor)).toContain('CREATE TABLE IF NOT EXISTS "users"');
    expect(postgres).not.toContain('"users"');
    expect(documentSettings(editor)).toEqual(SEED);
    await editor.expectDocumentKept();
  });

  it("takes every choice of the window's own, which the document never holds", async () => {
    const editor = await openReadonlyEditor();
    await editor.openTab('Schema SQL');
    const opened = codeOf(editor);

    await pressSegments(editor, 'schema-sql-statements');
    await pressSegments(editor, 'schema-sql-header');
    await userEvent.click(
      panelOf(editor).querySelector(
        '.schema-sql-options-logical-name [role="switch"]'
      )!
    );
    const boxes = panelOf(editor).querySelectorAll<HTMLInputElement>(
      '.schema-sql-options-tables input'
    );
    expect(boxes).toHaveLength(3);
    for (const box of boxes) await userEvent.click(box);
    await drawn();

    expect(codeOf(editor)).not.toBe(opened);
    await editor.expectDocumentKept();
  });

  it('keeps both scripts read only, taking no typing, and the DDL keeps writing them', async () => {
    const editor = await openReadonlyEditor();
    await editor.openTab('Schema SQL');

    for (const [id, script] of [
      ['schema-sql-before', 'SET NAMES utf8mb4;'],
      ['schema-sql-after', ''],
    ]) {
      const field = panelOf(editor).querySelector<HTMLTextAreaElement>(
        `#${id}`
      )!;
      expect(field.readOnly, id).toBe(true);
      expect(field.getAttribute('aria-readonly'), id).toBe('true');

      field.focus();
      expect(editor.shadow.activeElement, id).toBe(field);
      await userEvent.keyboard('DROP TABLE users;{Enter}{Backspace}');
      field.blur();
      await drawn();

      expect(field.value, id).toBe(script);
    }
    expect(codeOf(editor)).toContain('SET NAMES utf8mb4;');
    await editor.expectDocumentKept();
  });

  it('copies and saves the DDL this screen shows', async () => {
    const editor = await openReadonlyEditor();
    await editor.openTab('Schema SQL');
    await choose(editor, 'schema-sql-database', Database.PostgreSQL);
    const shown = codeOf(editor);
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);
    const saved: Array<Promise<string>> = [];
    setExportFileCallback(blob => {
      saved.push(blob.text());
    });

    await userEvent.click(
      panelOf(editor).querySelector('.schema-sql-options-copy')!
    );
    await userEvent.click(
      panelOf(editor).querySelector('.schema-sql-options-save')!
    );
    await drawn();

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(shownAs(writeText.mock.calls[0][0])).toBe(shown);
    expect(saved).toHaveLength(1);
    expect(shownAs(await saved[0])).toBe(shown);
    await editor.expectDocumentKept();
  });
});

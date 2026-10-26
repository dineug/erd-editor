// A readonly editor's Code Generator tab in a real element over a document whose
// locks are off: each setting its panel turns rewrites the code on this screen
// alone, while the document, a peer and the change event keep the document's.

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
import { BracketType, Database, Language, NameCase } from '@/constants/schema';
import { setExportFileCallback } from '@/utils/file/exportFile';

// The code block's highlighter is a shared worker whose shiki modules the dev
// server would discover mid-run and reload every spec for; plain text will do.
vi.mock('@/services/shiki', () => ({ getShikiService: () => null }));

afterEach(() => {
  closeReadonlyEditors();
  setExportFileCallback(null);
  vi.restoreAllMocks();
});

/** The code block drops the generators' trailing blank line, which a copy or a file keeps. */
const shownAs = (code: string) => code.replace(/\n+$/, '');

const codeOf = ({ shadow }: ReadonlyEditor) =>
  shadow.querySelector<HTMLTextAreaElement>(`.${String(styles.code)} textarea`)!
    .value;

/** Picks a value in one of the panel's lists, as a reader's pick fires its change. */
async function choose({ shadow }: ReadonlyEditor, id: string, value: number) {
  const select = shadow.querySelector<HTMLSelectElement>(`#${id}`)!;
  select.value = String(value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await drawn();
}

const SETTINGS = [
  'language',
  'database',
  'tableNameCase',
  'columnNameCase',
  'bracketType',
] as const;

const documentSettings = ({ el }: ReadonlyEditor) => {
  const { settings } = JSON.parse(el.value);
  return Object.fromEntries(SETTINGS.map(key => [key, settings[key]]));
};

const SEED_CODE_SETTINGS = Object.fromEntries(
  SETTINGS.map(key => [key, READONLY_SEED_SETTINGS[key]])
);

describe("a readonly editor's Code Generator tab over a document with its locks off", () => {
  it('rewrites the code on this screen for the language, the database, both name cases and the bracket, the document and a peer keeping theirs', async () => {
    const editor = await openReadonlyEditor();
    await editor.openTab('Code Generator');
    const opened = codeOf(editor);
    expect(opened).toContain('export interface Users {');
    // Each pick rewrites the code the one before left, in a way only it writes.
    const steps: Array<[id: string, value: number, writes: string]> = [
      ['generator-code-language', Language.Doctrine, '#[ORM\\Entity]'],
      ['generator-code-database', Database.Oracle, "Table(name: 'USERS')"],
      ['generator-code-table-name-case', NameCase.snakeCase, 'class users'],
      ['generator-code-column-name-case', NameCase.pascalCase, 'int $Id;'],
      [
        'generator-code-bracket',
        BracketType.backtick,
        "Table(name: '`users`')",
      ],
    ];
    let before = opened;

    for (const [id, value, writes] of steps) {
      await choose(editor, id, value);
      const code = codeOf(editor);

      expect(code, id).not.toBe(before);
      expect(before, id).not.toContain(writes);
      expect(code, id).toContain(writes);
      expect(
        editor.shadow.querySelector<HTMLSelectElement>(`#${id}`)!.value
      ).toBe(String(value));
      expect(documentSettings(editor), id).toEqual(SEED_CODE_SETTINGS);
      before = code;
    }
    await editor.expectDocumentKept();
  });

  it('copies and saves the code this screen shows, the document left as it was', async () => {
    const editor = await openReadonlyEditor();
    await editor.openTab('Code Generator');
    await choose(editor, 'generator-code-language', Language.Kotlin);
    const shown = codeOf(editor);
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);
    const saved: Array<{ text: Promise<string>; fileName: string }> = [];
    setExportFileCallback((blob, { fileName }) => {
      saved.push({ text: blob.text(), fileName });
    });

    await userEvent.click(
      editor.shadow.querySelector('.generator-code-options-copy')!
    );
    await userEvent.click(
      editor.shadow.querySelector('.generator-code-options-save')!
    );
    await drawn();

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(shownAs(writeText.mock.calls[0][0])).toBe(shown);
    expect(saved).toHaveLength(1);
    expect(saved[0].fileName).toMatch(/^shop-.*\.kt$/);
    expect(shownAs(await saved[0].text)).toBe(shown);
    await editor.expectDocumentKept();
  });
});

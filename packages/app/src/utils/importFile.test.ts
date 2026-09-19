import { describe, expect, it, vi } from 'vite-plus/test';

import { BACKUP_FORMAT } from '@/utils/backup';
import {
  classifyImportFile,
  describeImportResult,
  IMPORT_ACCEPT,
  isEditorDocument,
  MAX_IMPORT_FILE_SIZE,
  readImportFile,
} from '@/utils/importFile';

const NOW = Date.UTC(2026, 8, 19, 9);
const DOCUMENT = JSON.stringify({ version: '3.0.0', doc: {} });
const LEGACY_DOCUMENT = JSON.stringify({
  canvas: { version: '2.2.0' },
  table: { tables: [] },
  memo: { memos: [] },
  relationship: { relationships: [] },
});

describe('classifyImportFile', () => {
  it.each([
    ['shop.sql', 'sql'],
    ['shop.SQL', 'sql'],
    ['shop.dbml', 'dbml'],
    ['shop.aml', 'aml'],
    ['shop.graphql', 'graphql'],
    ['shop.gql', 'graphql'],
    ['shop.graphqls', 'graphql'],
  ])('reads %s as a %s source named after the file', (fileName, type) => {
    expect(
      classifyImportFile(fileName, 'create table a (id int);', NOW)
    ).toEqual({
      kind: 'source',
      name: 'shop',
      source: { type, value: 'create table a (id int);' },
    });
  });

  it('refuses an empty source', () => {
    expect(classifyImportFile('empty.sql', ' \n', NOW)).toEqual({
      kind: 'invalid',
      fileName: 'empty.sql',
    });
  });

  it.each(['shop.erd', 'shop.vuerd', 'shop.json'])(
    'reads %s as an editor document',
    fileName => {
      expect(classifyImportFile(fileName, DOCUMENT, NOW)).toEqual({
        kind: 'schema',
        schema: { name: 'shop', value: DOCUMENT },
      });
    }
  );

  it('keeps every dot of the name but the extension', () => {
    expect(classifyImportFile('shop.v2.erd', DOCUMENT, NOW)).toMatchObject({
      schema: { name: 'shop.v2' },
    });
  });

  it('reads a legacy .vuerd document', () => {
    expect(classifyImportFile('shop.vuerd', LEGACY_DOCUMENT, NOW)).toEqual({
      kind: 'schema',
      schema: { name: 'shop', value: LEGACY_DOCUMENT },
    });
  });

  it('refuses a JSON object that is not an editor document', () => {
    const packageJson = JSON.stringify({ name: 'x', version: '1.0.0' });

    expect(classifyImportFile('package.json', packageJson, NOW)).toEqual({
      kind: 'invalid',
      fileName: 'package.json',
    });
    expect(classifyImportFile('empty.erd', '{}', NOW).kind).toBe('invalid');
  });

  it.each([
    'notes.constructor',
    'x.__proto__',
    'x.toString',
    'x.hasOwnProperty',
  ])(
    'does not take %s for a source by what every object inherits',
    fileName => {
      expect(classifyImportFile(fileName, 'hello', NOW)).toEqual({
        kind: 'invalid',
        fileName,
      });
    }
  );

  it('refuses a document that is not a JSON object', () => {
    expect(classifyImportFile('shop.erd', '{', NOW).kind).toBe('invalid');
    expect(classifyImportFile('shop.json', '[1, 2]', NOW).kind).toBe('invalid');
    expect(classifyImportFile('shop.json', 'null', NOW).kind).toBe('invalid');
  });

  it('tells a backup by its content, whatever the file is called', () => {
    const text = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: 0,
      schemas: [
        { name: 'Orders', value: '', createAt: 1, updateAt: 2 },
        { name: 'Broken' },
      ],
    });

    expect(classifyImportFile('anything.erd', text, NOW)).toEqual({
      kind: 'backup',
      schemas: [{ name: 'Orders', value: '', createAt: 1, updateAt: 2 }],
      skipped: 1,
    });
  });

  it('refuses a backup of a version it does not know', () => {
    const text = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 9,
      schemas: [],
    });

    expect(classifyImportFile('backup.json', text, NOW).kind).toBe('invalid');
  });

  it('reads a file of another extension by its content', () => {
    expect(classifyImportFile('notes', DOCUMENT, NOW)).toEqual({
      kind: 'schema',
      schema: { name: 'notes', value: DOCUMENT },
    });
    expect(classifyImportFile('.hidden', DOCUMENT, NOW)).toMatchObject({
      schema: { name: '.hidden' },
    });
    expect(classifyImportFile('notes.txt', 'plain text', NOW).kind).toBe(
      'invalid'
    );
  });
});

describe('isEditorDocument', () => {
  it('takes the version 3 shape with its doc', () => {
    expect(isEditorDocument({ version: '3.0.0', doc: {} })).toBe(true);
    expect(isEditorDocument({ version: '3.0.0', collections: {} })).toBe(false);
    expect(isEditorDocument({ version: '3.0.0', doc: [] })).toBe(false);
  });

  it('takes the version 2 shape with its canvas and table', () => {
    expect(isEditorDocument(JSON.parse(LEGACY_DOCUMENT))).toBe(true);
    expect(isEditorDocument({ canvas: {} })).toBe(false);
    expect(isEditorDocument({ table: {} })).toBe(false);
    expect(isEditorDocument({ canvas: 1, table: {} })).toBe(false);
  });

  it('refuses anything else', () => {
    expect(isEditorDocument({ name: 'x', version: '1.0.0' })).toBe(false);
    expect(isEditorDocument({ version: '2.0.0', doc: {} })).toBe(false);
    expect(isEditorDocument([])).toBe(false);
    expect(isEditorDocument(null)).toBe(false);
    expect(isEditorDocument('{}')).toBe(false);
  });
});

describe('readImportFile', () => {
  it('reads and classifies a file', async () => {
    const file = new File([DOCUMENT], 'shop.erd');

    await expect(readImportFile(file, NOW)).resolves.toEqual({
      kind: 'schema',
      schema: { name: 'shop', value: DOCUMENT },
    });
  });

  it('passes the import time on to a backup', async () => {
    const file = new File(
      [
        JSON.stringify({
          format: BACKUP_FORMAT,
          version: 1,
          schemas: [{ name: 'Orders', value: '', createAt: 1, updateAt: 8e15 }],
        }),
      ],
      'backup.json'
    );

    await expect(readImportFile(file, NOW)).resolves.toEqual({
      kind: 'backup',
      schemas: [{ name: 'Orders', value: '', createAt: 1, updateAt: NOW }],
      skipped: 0,
    });
  });

  it('leaves a file over the size limit unread', async () => {
    const file = new File([DOCUMENT], 'huge.erd');
    Object.defineProperty(file, 'size', { value: MAX_IMPORT_FILE_SIZE + 1 });
    const text = vi.spyOn(file, 'text');

    await expect(readImportFile(file, NOW)).resolves.toEqual({
      kind: 'oversized',
      fileName: 'huge.erd',
    });
    expect(text).not.toHaveBeenCalled();
  });

  it('reads a file at the size limit', async () => {
    const file = new File([DOCUMENT], 'shop.erd');
    Object.defineProperty(file, 'size', { value: MAX_IMPORT_FILE_SIZE });

    await expect(readImportFile(file, NOW)).resolves.toMatchObject({
      kind: 'schema',
    });
  });

  it('counts a file that cannot be read as invalid', async () => {
    const file = new File([DOCUMENT], 'gone.erd');
    vi.spyOn(file, 'text').mockRejectedValue(new Error('NotReadableError'));

    await expect(readImportFile(file, NOW)).resolves.toEqual({
      kind: 'invalid',
      fileName: 'gone.erd',
    });
  });
});

describe('IMPORT_ACCEPT', () => {
  it('offers every extension the importer reads', () => {
    expect(IMPORT_ACCEPT.split(',')).toEqual([
      '.json',
      '.erd',
      '.vuerd',
      '.sql',
      '.dbml',
      '.aml',
      '.graphql',
      '.gql',
      '.graphqls',
    ]);
  });
});

describe('describeImportResult', () => {
  it('counts what came in', () => {
    expect(
      describeImportResult({
        imported: 1,
        skippedFiles: 0,
        skippedSchemas: 0,
        oversizedFiles: 0,
      })
    ).toBe('Imported 1 schema');
    expect(
      describeImportResult({
        imported: 3,
        skippedFiles: 0,
        skippedSchemas: 0,
        oversizedFiles: 0,
      })
    ).toBe('Imported 3 schemas');
  });

  it('adds what was skipped', () => {
    expect(
      describeImportResult({
        imported: 2,
        skippedFiles: 1,
        skippedSchemas: 2,
        oversizedFiles: 1,
      })
    ).toBe(
      'Imported 2 schemas · Skipped 1 invalid file · Skipped 2 invalid schemas · Skipped 1 file over 64 MB'
    );
    expect(
      describeImportResult({
        imported: 0,
        skippedFiles: 2,
        skippedSchemas: 1,
        oversizedFiles: 2,
      })
    ).toBe(
      'Skipped 2 invalid files · Skipped 1 invalid schema · Skipped 2 files over 64 MB'
    );
  });

  it('says so when there was nothing', () => {
    expect(
      describeImportResult({
        imported: 0,
        skippedFiles: 0,
        skippedSchemas: 0,
        oversizedFiles: 0,
      })
    ).toBe('Nothing to import');
  });
});

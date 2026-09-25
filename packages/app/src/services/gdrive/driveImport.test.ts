import { describe, expect, it, vi } from 'vite-plus/test';

import { USERS_DOCUMENT } from '@/__test-utils__/driveDocument';
import type { DriveFile, NewDriveFile } from '@/services/gdrive/driveClient';
import {
  describeDriveImport,
  type DriveImportResult,
  importToDrive,
  isCleanImport,
  planDriveImport,
} from '@/services/gdrive/driveImport';
import { MAX_IMPORT_FILE_SIZE } from '@/utils/importFile';

vi.mock('@/utils/convertSource', () => ({
  convertSource: ({ value }: { value: string }) => {
    if (value.includes('broken')) throw new Error('parse error');
    return `converted:${value}`;
  },
}));

const BACKUP = JSON.stringify({
  format: 'erd-editor-app-backup',
  version: 1,
  exportedAt: 0,
  schemas: [{ name: 'a', value: USERS_DOCUMENT, createAt: 0, updateAt: 0 }],
});

function fakeDrive(refuse: (file: NewDriveFile) => boolean = () => false) {
  const created: NewDriveFile[] = [];
  return {
    created,
    createFile: vi.fn(async (file: NewDriveFile): Promise<DriveFile> => {
      if (refuse(file)) throw new Error('refused');
      created.push(file);
      return {
        id: `created-${created.length}`,
        name: file.name,
        mimeType: 'application/json',
        modifiedTime: '2026-09-25T09:00:00.000Z',
        size: file.content.length,
        trashed: false,
        parents: [file.parentId],
        canEdit: true,
        canRename: true,
      };
    }),
  };
}

const result = (patch: Partial<DriveImportResult>): DriveImportResult => ({
  imported: 0,
  backups: 0,
  invalid: 0,
  oversized: 0,
  failed: 0,
  ...patch,
});

describe('planDriveImport', () => {
  it('names every document as a new .erd.json, never twice', async () => {
    const { uploads, result: counted } = await planDriveImport(
      [
        { kind: 'schema', schema: { name: 'foo.erd', value: USERS_DOCUMENT } },
        { kind: 'schema', schema: { name: 'bar', value: USERS_DOCUMENT } },
        { kind: 'schema', schema: { name: 'old.vuerd', value: '{}' } },
        { kind: 'source', name: 'shop', source: { type: 'sql', value: 'x' } },
      ],
      async () => 'converted'
    );

    expect(uploads.map(upload => upload.name)).toEqual([
      'foo.erd.json',
      'bar.erd.json',
      'old.erd.json',
      'shop.erd.json',
    ]);
    expect(uploads[3].content).toBe('converted');
    expect(counted).toEqual(result({}));
  });

  it('refuses backups and counts what it cannot read', async () => {
    const { uploads, result: counted } = await planDriveImport(
      [
        { kind: 'backup', schemas: [], skipped: 0 },
        { kind: 'invalid', fileName: 'a.txt' },
        { kind: 'oversized', fileName: 'big.erd' },
        { kind: 'source', name: 'bad', source: { type: 'sql', value: 'x' } },
      ],
      async () => {
        throw new Error('parse error');
      }
    );

    expect(uploads).toEqual([]);
    expect(counted).toEqual(result({ backups: 1, invalid: 2, oversized: 1 }));
  });
});

const FOLDER_ID = 'app-folder';

function folder() {
  return vi.fn(async () => FOLDER_ID);
}

describe('importToDrive', () => {
  it('uploads each document to the folder and keeps foo.erd.json as it is', async () => {
    const drive = fakeDrive();
    const folderId = folder();

    const { created, result: counted } = await importToDrive(
      { drive, folderId, convert: async ({ value }) => `from:${value}` },
      [
        new File([USERS_DOCUMENT], 'foo.erd.json'),
        new File(['create table a (id int);'], 'shop.sql'),
        new File([BACKUP], 'erd-editor-backup.json'),
      ]
    );

    expect(drive.created).toEqual([
      { name: 'foo.erd.json', parentId: FOLDER_ID, content: USERS_DOCUMENT },
      {
        name: 'shop.erd.json',
        parentId: FOLDER_ID,
        content: 'from:create table a (id int);',
      },
    ]);
    expect(created.map(file => file.id)).toEqual(['created-1', 'created-2']);
    expect(counted).toEqual(result({ imported: 2, backups: 1 }));
    expect(folderId).toHaveBeenCalledTimes(1);
  });

  it('asks for no folder when nothing is left to upload', async () => {
    const drive = fakeDrive();
    const folderId = folder();

    const { result: counted } = await importToDrive({ drive, folderId }, [
      new File([BACKUP], 'erd-editor-backup.json'),
      new File(['not json'], 'notes.json'),
    ]);

    expect(folderId).not.toHaveBeenCalled();
    expect(counted).toEqual(result({ backups: 1, invalid: 1 }));
  });

  it('counts every upload as failed when the folder cannot be had', async () => {
    const drive = fakeDrive();

    const { created, result: counted } = await importToDrive(
      {
        drive,
        folderId: async () => {
          throw new Error('offline');
        },
      },
      [
        new File([USERS_DOCUMENT], 'a.erd'),
        new File([USERS_DOCUMENT], 'b.erd'),
        new File([BACKUP], 'erd-editor-backup.json'),
      ]
    );

    expect(created).toEqual([]);
    expect(drive.createFile).not.toHaveBeenCalled();
    expect(counted).toEqual(result({ failed: 2, backups: 1 }));
  });

  it('parses a source with the editor by default, and counts a parse failure', async () => {
    const drive = fakeDrive();

    const { result: counted } = await importToDrive(
      { drive, folderId: folder() },
      [
        new File(['table users { id int }'], 'shop.dbml'),
        new File(['broken'], 'bad.sql'),
      ]
    );

    expect(drive.created).toEqual([
      {
        name: 'shop.erd.json',
        parentId: FOLDER_ID,
        content: 'converted:table users { id int }',
      },
    ]);
    expect(counted).toEqual(result({ imported: 1, invalid: 1 }));
  });

  it('goes on past an upload Drive refuses, and reads no file over the limit', async () => {
    const drive = fakeDrive(file => file.name === 'first.erd.json');
    const big = new File(['{}'], 'big.erd');
    Object.defineProperty(big, 'size', { value: MAX_IMPORT_FILE_SIZE + 1 });

    const { created, result: counted } = await importToDrive(
      { drive, folderId: folder(), now: () => 0 },
      [
        new File([USERS_DOCUMENT], 'first.erd'),
        new File([USERS_DOCUMENT], 'second.erd'),
        big,
        new File(['not json'], 'notes.json'),
      ]
    );

    expect(created.map(file => file.name)).toEqual(['second.erd.json']);
    expect(counted).toEqual(
      result({ imported: 1, failed: 1, oversized: 1, invalid: 1 })
    );
  });
});

describe('describeDriveImport', () => {
  it.each([
    [result({ imported: 1 }), 'Imported 1 file to Google Drive'],
    [
      result({ imported: 2, backups: 1 }),
      'Imported 2 files to Google Drive · Skipped 1 backup: backups stay in the local app',
    ],
    [
      result({ backups: 2, invalid: 1, oversized: 2, failed: 3 }),
      'Skipped 2 backups: backups stay in the local app · Skipped 1 invalid file · Skipped 2 files over 64 MB · 3 uploads failed',
    ],
    [result({ failed: 1 }), '1 upload failed'],
    [result({}), 'Nothing to import'],
  ])('%j reads %s', (counted, text) => {
    expect(describeDriveImport(counted)).toBe(text);
  });
});

describe('isCleanImport', () => {
  it('is true only when everything imported', () => {
    expect(isCleanImport(result({ imported: 2 }))).toBe(true);
    expect(isCleanImport(result({}))).toBe(false);
    expect(isCleanImport(result({ imported: 1, backups: 1 }))).toBe(false);
    expect(isCleanImport(result({ imported: 1, invalid: 1 }))).toBe(false);
    expect(isCleanImport(result({ imported: 1, oversized: 1 }))).toBe(false);
    expect(isCleanImport(result({ imported: 1, failed: 1 }))).toBe(false);
  });
});

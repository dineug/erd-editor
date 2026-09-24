import type { DriveClient, DriveFile } from '@/services/gdrive/driveClient';
import { toNewFileName } from '@/services/gdrive/driveFileName';
import {
  type ImportItem,
  MAX_IMPORT_FILE_SIZE,
  readImportFile,
  type SourceImport,
} from '@/utils/importFile';

/** What an import to Drive did with the files it was given. */
export type DriveImportResult = {
  imported: number;
  /** App backups, which stay with the local app: /gdrive never takes local data. */
  backups: number;
  invalid: number;
  oversized: number;
  /** Documents Drive did not take. */
  failed: number;
};

/** A new Drive file an import makes: its name and the document it holds. */
export type DriveUpload = { name: string; content: string };

export type DriveImportDeps = {
  drive: Pick<DriveClient, 'createFile'>;
  /** SQL, DBML, AML or GraphQL to a document; the default loads the editor on demand. */
  convert?: (source: SourceImport) => Promise<string>;
  now?: () => number;
};

async function convertWithEditor(source: SourceImport): Promise<string> {
  const { convertSource } = await import('@/utils/convertSource');
  return convertSource(source);
}

const emptyResult = (): DriveImportResult => ({
  imported: 0,
  backups: 0,
  invalid: 0,
  oversized: 0,
  failed: 0,
});

/**
 * The uploads the files make, one document each, named as a new file is. A
 * source the editor fails to parse counts as invalid, and a backup is refused.
 */
export async function planDriveImport(
  items: ImportItem[],
  convert: (source: SourceImport) => Promise<string>
): Promise<{ uploads: DriveUpload[]; result: DriveImportResult }> {
  const result = emptyResult();
  const uploads: DriveUpload[] = [];

  for (const item of items) {
    switch (item.kind) {
      case 'backup':
        result.backups += 1;
        break;
      case 'invalid':
        result.invalid += 1;
        break;
      case 'oversized':
        result.oversized += 1;
        break;
      case 'schema':
        // A document's schema always carries the file's text.
        uploads.push({
          name: toNewFileName(item.schema.name),
          content: item.schema.value ?? '',
        });
        break;
      case 'source':
        try {
          uploads.push({
            name: toNewFileName(item.name),
            content: await convert(item.source),
          });
        } catch {
          result.invalid += 1;
        }
        break;
    }
  }
  return { uploads, result };
}

/**
 * Uploads every document the files hold to My Drive as a new .erd.json, one
 * after another; a file Drive refuses is counted and the rest go on.
 */
export async function importToDrive(
  { drive, convert = convertWithEditor, now = Date.now }: DriveImportDeps,
  files: File[]
): Promise<{ created: DriveFile[]; result: DriveImportResult }> {
  const at = now();
  const items = await Promise.all(files.map(file => readImportFile(file, at)));
  const { uploads, result } = await planDriveImport(items, convert);
  const created: DriveFile[] = [];

  for (const { name, content } of uploads) {
    try {
      created.push(await drive.createFile({ name, parentId: null, content }));
      result.imported += 1;
    } catch {
      result.failed += 1;
    }
  }
  return { created, result };
}

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

/** The one line the notice shows, in the order things were counted. */
export function describeDriveImport(result: DriveImportResult): string {
  const parts = [
    result.imported
      ? `Imported ${plural(result.imported, 'file')} to Google Drive`
      : '',
    result.backups
      ? `Skipped ${plural(result.backups, 'backup')}: backups stay in the local app`
      : '',
    result.invalid ? `Skipped ${plural(result.invalid, 'invalid file')}` : '',
    result.oversized
      ? `Skipped ${plural(result.oversized, 'file')} over ${MAX_IMPORT_FILE_SIZE / 1024 / 1024} MB`
      : '',
    result.failed ? `${plural(result.failed, 'upload')} failed` : '',
  ].filter(Boolean);

  return parts.length ? parts.join(' · ') : 'Nothing to import';
}

/** Success only when every file became a Drive file. */
export function isCleanImport(result: DriveImportResult): boolean {
  return (
    result.imported > 0 &&
    !result.backups &&
    !result.invalid &&
    !result.oversized &&
    !result.failed
  );
}

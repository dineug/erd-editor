import { omit } from 'es-toolkit';
import { atom, useAtomValue, useSetAtom, useStore } from 'jotai';
import { DateTime } from 'luxon';
import { useCallback } from 'react';

import { schemaEntitiesAtom } from '@/atoms/modules/schema';
import { selectedSchemaIdAtom } from '@/atoms/modules/sidebar';
import { getAppDatabaseService } from '@/services/indexeddb';
import type { NewSchemaEntity } from '@/services/indexeddb/modules/schema';
import { backupFileName, createBackup } from '@/utils/backup';
import { addSchemaEntityAction, dispatch } from '@/utils/broadcastChannel';
import { downloadFile, pickFiles } from '@/utils/file';
import {
  describeImportResult,
  IMPORT_ACCEPT,
  type ImportItem,
  type ImportResult,
  readImportFile,
  type SourceImport,
} from '@/utils/importFile';
import { reportError } from '@/utils/reportError';

type Store = ReturnType<typeof useStore>;

export type ImportNotice = {
  key: number;
  message: string;
  tone: 'success' | 'warning';
};

const SAMPLE_NAME = 'bookstore sample';

export const importNoticeAtom = atom<ImportNotice | null>(null);

const addImportedSchemasAtom = atom(
  null,
  async (get, set, list: NewSchemaEntity[]) => {
    const service = getAppDatabaseService();
    if (!service) throw new Error('Database service is not initialized');

    const result = await service.importSchemaEntities(list);
    const entities = result.map(entity => omit(entity, ['value']));

    set(schemaEntitiesAtom, draft => {
      draft.push(...entities);
    });
    entities.forEach(value => dispatch(addSchemaEntityAction({ value })));

    return result;
  }
);

const showImportNoticeAtom = atom(null, (get, set, result: ImportResult) => {
  const skipped =
    result.skippedFiles + result.skippedSchemas + result.oversizedFiles;

  set(importNoticeAtom, {
    key: Date.now(),
    message: describeImportResult(result),
    tone: result.imported && !skipped ? 'success' : 'warning',
  });
});

/**
 * Converts every source into the document it parses to; one the editor fails
 * on is counted as an invalid file. Loaded on demand, since it brings in the
 * whole editor.
 */
async function convertSources(
  sources: Array<{ name: string; source: SourceImport }>
) {
  const { convertSource } = await import('@/utils/convertSource');
  const documents: NewSchemaEntity[] = [];
  let failed = 0;

  for (const { name, source } of sources) {
    try {
      documents.push({ name, value: convertSource(source) });
    } catch (error) {
      console.error(error);
      failed += 1;
    }
  }

  return { documents, failed };
}

/**
 * Adds every schema the items carry, all in one go. Backup schemas keep their
 * times; the last document or source is opened, unless the user opened
 * something else while the import ran.
 */
async function applyImportItems(
  store: Store,
  items: ImportItem[],
  selectedAtStart: string | null
) {
  const result: ImportResult = {
    imported: 0,
    skippedFiles: 0,
    skippedSchemas: 0,
    oversizedFiles: 0,
  };
  const schemas: NewSchemaEntity[] = [];
  const documents: NewSchemaEntity[] = [];
  const sources: Array<{ name: string; source: SourceImport }> = [];

  for (const item of items) {
    switch (item.kind) {
      case 'backup':
        schemas.push(...item.schemas);
        result.skippedSchemas += item.skipped;
        break;
      case 'schema':
        documents.push(item.schema);
        break;
      case 'source':
        sources.push(item);
        break;
      case 'invalid':
        result.skippedFiles += 1;
        break;
      case 'oversized':
        result.oversizedFiles += 1;
        break;
    }
  }

  if (sources.length) {
    const converted = await convertSources(sources);
    documents.push(...converted.documents);
    result.skippedFiles += converted.failed;
  }

  if (schemas.length || documents.length) {
    const added = await store.set(addImportedSchemasAtom, [
      ...schemas,
      ...documents,
    ]);
    result.imported += added.length;

    if (
      documents.length &&
      store.get(selectedSchemaIdAtom) === selectedAtStart
    ) {
      store.set(selectedSchemaIdAtom, added[added.length - 1].id);
    }
  }

  store.set(showImportNoticeAtom, result);
  return result;
}

/**
 * Runs an import. A failure partway is said in the notice and reported, and the
 * import settles all the same.
 */
async function runImport(store: Store, read: () => Promise<ImportItem[]>) {
  const selectedAtStart = store.get(selectedSchemaIdAtom);

  try {
    return await applyImportItems(store, await read(), selectedAtStart);
  } catch (error) {
    store.set(importNoticeAtom, {
      key: Date.now(),
      message: 'Import failed',
      tone: 'warning',
    });
    reportError(error);
    return undefined;
  }
}

export const useImportNotice = () => useAtomValue(importNoticeAtom);

export const useDismissImportNotice = () => {
  const setNotice = useSetAtom(importNoticeAtom);
  return useCallback(() => setNotice(null), [setNotice]);
};

export const useImportFiles = () => {
  const store = useStore();

  return useCallback(
    (files: File[]) => {
      const now = Date.now();
      return runImport(store, () =>
        Promise.all(files.map(file => readImportFile(file, now)))
      );
    },
    [store]
  );
};

export const useOpenImportDialog = () => {
  const importFiles = useImportFiles();

  return useCallback(async () => {
    const files = await pickFiles(IMPORT_ACCEPT);
    if (files.length) await importFiles(files);
  }, [importFiles]);
};

/** Imports the bundled DBML sample, loaded on demand to keep it out of the entry chunk. */
export const useOpenSample = () => {
  const store = useStore();

  return useCallback(
    () =>
      runImport(store, async () => {
        const { default: value } = await import('@/assets/bookstore.dbml?raw');
        return [
          {
            kind: 'source',
            name: SAMPLE_NAME,
            source: { type: 'dbml', value },
          },
        ];
      }),
    [store]
  );
};

/** Downloads a backup of every schema; a failure is said in the notice and reported. */
export const useExportBackup = () => {
  const setNotice = useSetAtom(importNoticeAtom);

  return useCallback(async () => {
    try {
      const service = getAppDatabaseService();
      if (!service) throw new Error('Database service is not initialized');

      const entities = await service.exportSchemaEntities();
      const now = DateTime.now();

      downloadFile(
        backupFileName(now),
        JSON.stringify(createBackup(entities, now), null, 2),
        'application/json'
      );
    } catch (error) {
      setNotice({ key: Date.now(), message: 'Export failed', tone: 'warning' });
      reportError(error);
    }
  }, [setNotice]);
};

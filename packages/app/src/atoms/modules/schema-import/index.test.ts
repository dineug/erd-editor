import * as Sentry from '@sentry/react';
import { createStore } from 'jotai';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vite-plus/test';

import { collectUnhandledRejections } from '@/__test-utils__/rejections';
import { renderHook } from '@/__test-utils__/renderHook';
import { schemaEntitiesAtom } from '@/atoms/modules/schema';
import {
  importNoticeAtom,
  useExportBackup,
  useImportFiles,
  useOpenImportDialog,
  useOpenSample,
} from '@/atoms/modules/schema-import';
import { selectedSchemaIdAtom } from '@/atoms/modules/sidebar';
import type { AppDatabaseService } from '@/services/indexeddb/appDatabaseService';
import type {
  NewSchemaEntity,
  SchemaEntity,
} from '@/services/indexeddb/modules/schema';
import { BACKUP_FORMAT } from '@/utils/backup';
import { convertSource } from '@/utils/convertSource';
import { downloadFile, pickFiles } from '@/utils/file';
import { MAX_IMPORT_FILE_SIZE } from '@/utils/importFile';

const service = vi.hoisted(() => ({}) as Partial<AppDatabaseService>);

vi.mock('@/services/indexeddb', () => ({
  getAppDatabaseService: () => service,
}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));
// The real one builds an <erd-editor>, which needs a browser; e2e runs it.
vi.mock('@/utils/convertSource', () => ({ convertSource: vi.fn() }));
vi.mock('@/utils/file', () => ({ downloadFile: vi.fn(), pickFiles: vi.fn() }));

const NOW = Date.UTC(2026, 8, 19, 9);
const FAILURE = new Error('IndexedDB is gone');
const DOCUMENT = JSON.stringify({ version: '3.0.0', doc: {} });

type Store = ReturnType<typeof createStore>;

const parsed = (type: string, value: string) =>
  JSON.stringify({ version: '3.0.0', doc: {}, parsed: `${type}:${value}` });

/** Stores what it is given under ids of its own, stamped now where no time came. */
function importInto(stored: SchemaEntity[]) {
  return async (list: NewSchemaEntity[]) => {
    const result = list.map((item, index) => ({
      id: `imported-${stored.length + index + 1}`,
      value: '',
      createAt: NOW,
      updateAt: NOW,
      ...item,
    }));
    stored.push(...result);
    return result;
  };
}

async function fail(): Promise<never> {
  throw FAILURE;
}

const file = (name: string, text: string) => new File([text], name);

const names = (store: Store) =>
  store.get(schemaEntitiesAtom).map(entity => entity.name);

describe('schema import', () => {
  let store: Store;
  let stored: SchemaEntity[];
  let postMessage: MockInstance;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    store = createStore();
    stored = [];
    for (const key of Object.keys(service)) {
      Reflect.deleteProperty(service, key);
    }
    service.importSchemaEntities = importInto(stored);
    vi.mocked(convertSource).mockImplementation(({ type, value }) =>
      parsed(type, value)
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    postMessage = vi.spyOn(BroadcastChannel.prototype, 'postMessage');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.mocked(Sentry.captureException).mockClear();
    vi.mocked(convertSource).mockReset();
    vi.mocked(downloadFile).mockReset();
    vi.mocked(pickFiles).mockReset();
  });

  describe('sources', () => {
    it('stores the document a source parses to and opens it', async () => {
      const { result } = renderHook(useImportFiles, store);

      await result.current([file('shop.dbml', 'Table users {}')]);

      expect(convertSource).toHaveBeenCalledWith({
        type: 'dbml',
        value: 'Table users {}',
      });
      expect(stored).toEqual([
        expect.objectContaining({
          name: 'shop',
          value: parsed('dbml', 'Table users {}'),
          updateAt: NOW,
        }),
      ]);
      expect(store.get(selectedSchemaIdAtom)).toBe(stored[0].id);
      expect(store.get(importNoticeAtom)?.message).toBe('Imported 1 schema');
    });

    it('stores every source of a drop at once and opens the last', async () => {
      const { result } = renderHook(useImportFiles, store);

      await result.current([
        file('a.sql', 'create table a (id int);'),
        file('b.graphql', 'type B { id: ID }'),
        file('c.erd', DOCUMENT),
      ]);

      expect(stored.map(({ name, value }) => [name, value])).toEqual([
        ['c', DOCUMENT],
        ['a', parsed('sql', 'create table a (id int);')],
        ['b', parsed('graphql', 'type B { id: ID }')],
      ]);
      expect(store.get(selectedSchemaIdAtom)).toBe(stored[2].id);
      expect(store.get(importNoticeAtom)?.message).toBe('Imported 3 schemas');
    });

    it('counts a source the editor fails on as an invalid file', async () => {
      vi.mocked(convertSource).mockImplementation(({ type, value }) => {
        if (type === 'aml') throw new Error('unreadable');
        return parsed(type, value);
      });
      const { result } = renderHook(useImportFiles, store);

      await result.current([
        file('broken.aml', 'entity ???'),
        file('shop.sql', 'create table a (id int);'),
      ]);

      expect(names(store)).toEqual(['shop']);
      expect(store.get(importNoticeAtom)).toMatchObject({
        message: 'Imported 1 schema · Skipped 1 invalid file',
        tone: 'warning',
      });
    });

    it('leaves another schema the user opened meanwhile open', async () => {
      let finish: () => void = () => {};
      const importNow = service.importSchemaEntities!;
      service.importSchemaEntities = list =>
        new Promise(resolve => {
          finish = () => resolve(importNow(list));
        });
      const { result } = renderHook(useImportFiles, store);

      const importing = result.current([file('shop.sql', 'create table a;')]);
      await vi.waitFor(() => expect(convertSource).toHaveBeenCalled());
      store.set(selectedSchemaIdAtom, 'elsewhere');
      finish();
      await importing;

      expect(names(store)).toEqual(['shop']);
      expect(store.get(selectedSchemaIdAtom)).toBe('elsewhere');
    });
  });

  it('leaves the selection alone for a backup', async () => {
    store.set(selectedSchemaIdAtom, 'open');
    const { result } = renderHook(useImportFiles, store);

    await result.current([
      file(
        'backup.json',
        JSON.stringify({
          format: BACKUP_FORMAT,
          version: 1,
          schemas: [{ name: 'Orders', value: '', createAt: 1, updateAt: 2 }],
        })
      ),
    ]);

    expect(stored).toEqual([
      expect.objectContaining({ name: 'Orders', createAt: 1, updateAt: 2 }),
    ]);
    expect(store.get(selectedSchemaIdAtom)).toBe('open');
  });

  it('skips a file over the size limit without reading it', async () => {
    const huge = file('huge.erd', DOCUMENT);
    Object.defineProperty(huge, 'size', { value: MAX_IMPORT_FILE_SIZE + 1 });
    const text = vi.spyOn(huge, 'text');
    const { result } = renderHook(useImportFiles, store);

    await result.current([huge, file('shop.erd', DOCUMENT)]);

    expect(text).not.toHaveBeenCalled();
    expect(names(store)).toEqual(['shop']);
    expect(store.get(importNoticeAtom)).toMatchObject({
      message: 'Imported 1 schema · Skipped 1 file over 64 MB',
      tone: 'warning',
    });
  });

  it('tells the other tabs of each list entry without its document', async () => {
    const { result } = renderHook(useImportFiles, store);

    await result.current([file('shop.erd', DOCUMENT)]);

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({
      type: 'addSchemaEntity',
      payload: {
        value: { id: stored[0].id, name: 'shop', createAt: NOW, updateAt: NOW },
      },
    });
  });

  it('says so and settles when storing fails', async () => {
    service.importSchemaEntities = fail;
    const { result } = renderHook(useImportFiles, store);

    const reasons = await collectUnhandledRejections(async () => {
      await expect(
        result.current([file('shop.erd', DOCUMENT)])
      ).resolves.toBeUndefined();
    });

    expect(reasons).toEqual([]);
    expect(store.get(importNoticeAtom)).toMatchObject({
      message: 'Import failed',
      tone: 'warning',
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(FAILURE);
  });

  it('imports what the file chooser gives', async () => {
    vi.mocked(pickFiles).mockResolvedValue([file('shop.erd', DOCUMENT)]);
    const { result } = renderHook(useOpenImportDialog, store);

    await result.current();

    expect(pickFiles).toHaveBeenCalledWith(expect.stringContaining('.erd'));
    expect(names(store)).toEqual(['shop']);
  });

  it('does nothing when the file chooser is cancelled', async () => {
    vi.mocked(pickFiles).mockResolvedValue([]);
    const { result } = renderHook(useOpenImportDialog, store);

    await result.current();

    expect(stored).toEqual([]);
    expect(store.get(importNoticeAtom)).toBeNull();
  });

  it('opens the bundled sample as a DBML source', async () => {
    const { result } = renderHook(useOpenSample, store);

    await result.current();

    expect(convertSource).toHaveBeenCalledWith({
      type: 'dbml',
      value: expect.stringContaining('Table'),
    });
    expect(names(store)).toEqual(['bookstore sample']);
    expect(store.get(selectedSchemaIdAtom)).toBe(stored[0].id);
  });

  describe('backup export', () => {
    it('downloads every schema', async () => {
      service.exportSchemaEntities = async () => [
        { id: 'a', name: 'Orders', value: '', createAt: 1, updateAt: 2 },
      ];
      const { result } = renderHook(useExportBackup, store);

      await result.current();

      expect(downloadFile).toHaveBeenCalledWith(
        expect.stringMatching(/^erd-editor-backup-\d{4}-\d{2}-\d{2}\.json$/),
        expect.stringContaining('"Orders"'),
        'application/json'
      );
    });

    it('says so and settles when reading the schemas fails', async () => {
      service.exportSchemaEntities = fail;
      const { result } = renderHook(useExportBackup, store);

      const reasons = await collectUnhandledRejections(async () => {
        await expect(result.current()).resolves.toBeUndefined();
      });

      expect(reasons).toEqual([]);
      expect(downloadFile).not.toHaveBeenCalled();
      expect(store.get(importNoticeAtom)).toMatchObject({
        message: 'Export failed',
        tone: 'warning',
      });
      expect(Sentry.captureException).toHaveBeenCalledWith(FAILURE);
    });
  });
});

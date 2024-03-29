import { html } from '@vuerd/lit-observable';
import { DDLParser } from '@vuerd/sql-ddl-parser';
import { toBlob } from 'html-to-image';

import { Bus } from '@/core/helper/eventBus.helper';
import { createJson } from '@/core/parser/ParserToJson';
import { loadJson$ } from '@/engine/command/editor.cmd.helper';
import { sortTable } from '@/engine/command/table.cmd.helper';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { ExportOptions, ImportOptions } from '@@types/core/file';
import { ExportedStore, Store } from '@@types/engine/store';
import { SnapshotMetadata } from '@@types/engine/store/snapshot';

let executeExportFileExtra:
  | ((blob: Blob, options: ExportOptions) => void)
  | null = null;

let executeImportFileExtra: ((options: ImportOptions) => void) | null = null;

export const createJsonFormat = ({
  canvasState,
  tableState,
  memoState,
  relationshipState,
}: Store): ExportedStore => ({
  canvas: canvasState,
  table: tableState,
  memo: memoState,
  relationship: relationshipState,
});

export function createSnapshot(
  context: IERDEditorContext,
  metadata?: SnapshotMetadata
) {
  context.snapshots.push({
    data: createStoreCopy(context.store),
    metadata: metadata,
  });
}

export function createStoreCopy(store: Store): ExportedStore {
  return JSON.parse(createJsonStringify(store));
}

export const createJsonStringify = (store: Store, space?: number) =>
  JSON.stringify(
    createJsonFormat(store),
    (key, value) => (key.startsWith('_') ? undefined : value),
    space
  );

export function exportPNG(root: HTMLElement, name?: string) {
  const options: ExportOptions = {
    fileName:
      name?.trim() === ''
        ? `unnamed-${new Date().getTime()}.png`
        : `${name}-${new Date().getTime()}.png`,
  };

  toBlob(root).then(blob => {
    if (!blob) return;

    executeExport(blob, options);
  });
}

export const exportJSON = (json: string, name?: string) => {
  const options: ExportOptions = {
    fileName:
      name?.trim() === ''
        ? `unnamed-${new Date().getTime()}.vuerd.json`
        : `${name}-${new Date().getTime()}.vuerd.json`,
  };

  executeExport(new Blob([json], { type: 'application/json' }), options);
};

export const exportSQLDDL = (sql: string, name?: string) => {
  const options: ExportOptions = {
    fileName:
      name?.trim() === ''
        ? `unnamed-${new Date().getTime()}.sql`
        : `${name}-${new Date().getTime()}.sql`,
  };

  executeExport(new Blob([sql]), options);
};

export const exportXML = (
  xml: string,
  name?: string,
  saveDirectly?: boolean
) => {
  const options: ExportOptions = {
    saveDirectly: name ? true : false,
    fileName:
      name?.trim() === '' ? `unnamed-${new Date().getTime()}.xml` : `${name}`,
  };

  if (xml) executeExport(new Blob([xml]), options);
};

const executeExport = (blob: Blob, options: ExportOptions) =>
  executeExportFileExtra
    ? executeExportFileExtra(blob, options)
    : executeExportBuiltin(blob, options);

function executeExportBuiltin(blob: Blob, options: ExportOptions) {
  const exportHelper = document.createElement('a');
  exportHelper.href = window.URL.createObjectURL(blob);
  exportHelper.download = options.fileName;
  exportHelper.click();
}

export function setExportFileCallback(
  callback: (blob: Blob, options: ExportOptions) => void
) {
  executeExportFileExtra = callback;
}

export function setImportFileCallback(
  callback: (options: ImportOptions) => void
) {
  executeImportFileExtra = callback;
}

export function importJSON({ store, eventBus }: IERDEditorContext) {
  if (executeImportFileExtra) {
    executeImportFileExtra({ accept: '.json,.erd,.vuerd', type: 'json' });
    return;
  }

  const importHelperJSON = document.createElement('input');
  importHelperJSON.setAttribute('type', 'file');
  importHelperJSON.setAttribute('accept', '.json,.erd,.vuerd');
  importHelperJSON.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      const file = input.files[0];
      if (/\.(json|erd|vuerd)$/i.test(file.name)) {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
          const value = reader.result;
          if (typeof value === 'string') {
            store.dispatch(loadJson$(value));
          }
        };
      } else {
        eventBus.emit(Bus.ToastBar.add, {
          bodyTpl: html`Just import the json file`,
        });
      }
    }
  });
  importHelperJSON.click();
}

export function importSQLDDL(context: IERDEditorContext) {
  if (executeImportFileExtra) {
    executeImportFileExtra({ accept: '.sql', type: 'sql' });
    return;
  }

  const importHelper = document.createElement('input');
  importHelper.setAttribute('type', 'file');
  importHelper.setAttribute('accept', `.sql`);
  importHelper.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      const file = input.files[0];
      const { helper, store, eventBus } = context;

      if (/\.(sql)$/i.test(file.name)) {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
          const value = reader.result;
          if (typeof value === 'string') {
            const statements = DDLParser(value);

            const json = createJson(
              // @ts-ignore
              statements,
              helper,
              store.canvasState.database
            );
            store.dispatchSync(loadJson$(json), sortTable());
          }
        };
      } else {
        eventBus.emit(Bus.ToastBar.add, {
          bodyTpl: html`Just import the sql file`,
        });
      }
    }
  });
  importHelper.click();
}

import { DDLParser } from '@vuerd/sql-ddl-parser';
import domToImage from 'dom-to-image';

import { calculateLatestDiff } from '@/core/diff/helper';
import { Logger } from '@/core/logger';
import { Dialect } from '@/core/parser/helper';
import { LiquibaseParser } from '@/core/parser/LiquibaseParser';
import { createJson } from '@/core/parser/ParserToJson';
import { loadJson$ } from '@/engine/command/editor.cmd.helper';
import { sortTable } from '@/engine/command/table.cmd.helper';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { LiquibaseFile, LoadLiquibaseData } from '@@types/core/liquibaseParser';
import { ExportedStore, Store } from '@@types/engine/store';
import { SnapshotMetadata } from '@@types/engine/store/snapshot';

export interface ExportOptions {
  fileName: string;
  saveDirectly?: boolean;
}

let executeExportFileExtra:
  | ((blob: Blob, options: ExportOptions) => void)
  | null = null;

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

export function exportPNG(root: Element, name?: string) {
  const options: ExportOptions = {
    fileName:
      name?.trim() === ''
        ? `unnamed-${new Date().getTime()}.png`
        : `${name}-${new Date().getTime()}.png`,
  };

  domToImage.toBlob(root).then(blob => {
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

export function importJSON({ store }: IERDEditorContext) {
  const importHelperJSON = document.createElement('input');
  importHelperJSON.setAttribute('type', 'file');
  importHelperJSON.setAttribute('accept', '.json');
  importHelperJSON.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      const file = input.files[0];
      if (/\.(json)$/i.test(file.name)) {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
          const value = reader.result;
          if (typeof value === 'string') {
            store.dispatch(loadJson$(value));
          }
        };
      } else {
        alert('Just upload the json file');
      }
    }
  });
  importHelperJSON.click();
}

export function importSQLDDL(context: IERDEditorContext) {
  const importHelper = document.createElement('input');
  importHelper.setAttribute('type', 'file');
  importHelper.setAttribute('accept', `.sql`);
  importHelper.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      Array.from(input.files)
        .sort((a: File, b: File) => a.name.localeCompare(b.name))
        .forEach(file => {
          const regex = new RegExp(`\.(sql)$`, 'i');
          if (regex.test(file.name)) {
            const reader = new FileReader();
            reader.readAsText(file);
            reader.onload = () => {
              const value = reader.result;
              if (typeof value === 'string') {
                const { helper, store } = context;

                const statements = DDLParser(value);

                const json = createJson(
                  // @ts-ignore
                  statements,
                  helper,
                  store.canvasState.database
                );
                store.dispatchSync(loadJson$(json), sortTable());

                var { snapshots } = context;
                createSnapshot(context);
                Logger.log('SNAPSHOTS', snapshots);
              }
            };
          } else {
            alert(`Just upload the sql file`);
          }
        });
    }
  });
  importHelper.click();
}

export function importLiquibase(context: IERDEditorContext, dialect: Dialect) {
  if (
    calculateLatestDiff(context).length === 0 ||
    window.confirm(
      'Found changes, are you sure you want to loose them? If you want to save changes (diff), please, make sure to EXPORT them first.\nPress OK to continue importing file, press CANCEL to abort importing.'
    )
  ) {
    const importHelper = document.createElement('input');
    importHelper.setAttribute('type', 'file');
    importHelper.setAttribute('multiple', 'true');
    importHelper.setAttribute('accept', `.xml`);
    importHelper.addEventListener('change', async event => {
      const input = event.target as HTMLInputElement;
      if (input.files && input.files.length) {
        const files = Array.from(input.files).sort((a: File, b: File) =>
          a.name.localeCompare(b.name)
        );

        var liquiFiles: LiquibaseFile[] = [];

        for (const file of files) {
          try {
            liquiFiles.push({
              path: file.name,
              value: await loadFileSync(file, 'xml'),
            });
          } catch (e) {}
        }

        LiquibaseParser(context, liquiFiles, dialect);
      }
    });
    importHelper.click();
  }
}

export async function loadFileSync(file: File, type: string): Promise<string> {
  const regex = new RegExp(`\.(${type})$`, 'i');
  if (regex.test(file.name)) {
    return await new Promise<string>(resolve => {
      let reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => {
        const value = reader.result;
        if (typeof value === 'string') resolve(value);
      };
    });
  } else throw new Error();
}

export function loadLiquibaseChangelog(
  context: IERDEditorContext,
  { files, type }: LoadLiquibaseData,
  dialect: Dialect
) {
  var root: LiquibaseFile | undefined = undefined;
  if (type === 'vscode' && files[0].path === 'changelog.xml') {
    root = files[0];
  }

  LiquibaseParser(context, files, dialect, root);
}

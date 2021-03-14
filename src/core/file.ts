import { JsonFormat } from '@@types/core/file';
import { Store } from '@@types/engine/store';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import domToImage from 'dom-to-image';
import { DDLParser } from '@dineug/sql-ddl-parser';
import { createJson } from '@/core/parser/SQLParserToJson';
import { loadJson$ } from '@/engine/command/editor.cmd.helper';
import { sortTable } from '@/engine/command/table.cmd.helper';

let executeExportFileExtra:
  | ((blob: Blob, fileName: string) => void)
  | null = null;

export const createJsonFormat = ({
  canvasState,
  tableState,
  memoState,
  relationshipState,
}: Store): JsonFormat => ({
  canvas: canvasState,
  table: tableState,
  memo: memoState,
  relationship: relationshipState,
});

export const createJsonStringify = (store: Store, space?: number) =>
  JSON.stringify(
    createJsonFormat(store),
    (key, value) => (key.startsWith('_') ? undefined : value),
    space
  );

export function exportPNG(root: Element, name?: string) {
  domToImage.toBlob(root).then(blob => {
    executeExport(
      blob,
      name?.trim() === ''
        ? `unnamed-${new Date().getTime()}.png`
        : `${name}-${new Date().getTime()}.png`
    );
  });
}

export const exportJSON = (json: string, name?: string) =>
  executeExport(
    new Blob([json], { type: 'application/json' }),
    name?.trim() === ''
      ? `unnamed-${new Date().getTime()}.vuerd.json`
      : `${name}-${new Date().getTime()}.vuerd.json`
  );

export const exportSQLDDL = (sql: string, name?: string) =>
  executeExport(
    new Blob([sql]),
    name?.trim() === ''
      ? `unnamed-${new Date().getTime()}.sql`
      : `${name}-${new Date().getTime()}.sql`
  );

const executeExport = (blob: Blob, fileName: string) =>
  executeExportFileExtra
    ? executeExportFileExtra(blob, fileName)
    : executeExportBuiltin(blob, fileName);

function executeExportBuiltin(blob: Blob, fileName: string) {
  const exportHelper = document.createElement('a');
  exportHelper.href = window.URL.createObjectURL(blob);
  exportHelper.download = fileName;
  exportHelper.click();
}

export function setExportFileCallback(
  callback: (blob: Blob, fileName: string) => void
) {
  executeExportFileExtra = callback;
}

export function importJSON({ store }: ERDEditorContext) {
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

export function importSQLDDL(context: ERDEditorContext) {
  const { store, helper } = context;
  const importHelperSQL = document.createElement('input');
  importHelperSQL.setAttribute('type', 'file');
  importHelperSQL.setAttribute('accept', '.sql');
  importHelperSQL.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const file = input.files[0];
      if (/\.(sql)$/i.test(file.name)) {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
          const value = reader.result;
          if (typeof value === 'string') {
            const statements = DDLParser(value);
            const json = createJson(
              statements,
              helper,
              store.canvasState.database
            );
            store.dispatch(loadJson$(json), sortTable());
          }
        };
      } else {
        alert('Just upload the sql file');
      }
    }
  });
  importHelperSQL.click();
}

import { DDLParser } from '@vuerd/sql-ddl-parser';
import domToImage from 'dom-to-image';

import { getLatestSnapshot } from '@/core/contextmenu/export.menu';
import { Logger } from '@/core/logger';
import { Statement } from '@/core/parser';
import { Dialect } from '@/core/parser/helper';
import { LiquibaseParser } from '@/core/parser/LiquibaseParser';
import { createJson } from '@/core/parser/ParserToJson';
import { loadJson$ } from '@/engine/command/editor.cmd.helper';
import { sortTable } from '@/engine/command/table.cmd.helper';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { ExportedStore, Store } from '@@types/engine/store';

let executeExportFileExtra: ((blob: Blob, fileName: string) => void) | null =
  null;

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

export const exportXML = (xml: string, name?: string) => {
  if (xml)
    executeExport(
      new Blob([xml]),
      name?.trim() === ''
        ? `unnamed-${new Date().getTime()}.xml`
        : `${name}-${new Date().getTime()}.xml`
    );
};

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
  // @ts-ignore
  importWrapper(context, 'sql', DDLParser, false, true);
}

export function importLiquibase(context: ERDEditorContext, dialect: Dialect) {
  const snapshot = getLatestSnapshot(context.snapshots);

  if (
    !snapshot ||
    !checkForChanges(createStoreCopy(context.store), snapshot) ||
    !window.confirm(
      'Found changes, are you sure you want to loose them? If you want to save changes (diff), please, make sure to export them first. Press OK to import file, press CANCEL to abort importing.'
    )
  ) {
    importWrapper(context, 'xml', LiquibaseParser, true, false, dialect);
  }
}

export function createStoreCopy(store: Store): ExportedStore {
  return JSON.parse(createJsonStringify(store));
}

export interface ParserCallback {
  (input: string, dialect?: Dialect): Statement[];
}

export function importWrapper(
  context: ERDEditorContext,
  type: string,
  parser: ParserCallback,
  multipleFiles: boolean = false,
  resetDiagram: boolean = true,
  dialect?: Dialect
) {
  const importHelper = document.createElement('input');
  importHelper.setAttribute('type', 'file');
  if (multipleFiles) {
    importHelper.setAttribute('multiple', 'true');
  }
  importHelper.setAttribute('accept', `.${type}`);
  importHelper.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      Array.from(input.files)
        .sort((a: File, b: File) => a.name.localeCompare(b.name))
        .forEach(file => {
          const regex = new RegExp(`\.(${type})$`, 'i');
          if (regex.test(file.name)) {
            const reader = new FileReader();
            reader.readAsText(file);
            reader.onload = () => {
              const value = reader.result;
              if (typeof value === 'string') {
                parseFile(context, value, parser, resetDiagram, dialect);
              }
            };
          } else {
            alert(`Just upload the ${type} file`);
          }
        });
    }
  });
  importHelper.click();
}

export function parseFile(
  context: ERDEditorContext,
  value: string,
  parser: ParserCallback,
  resetDiagram: boolean,
  dialect?: Dialect
) {
  const { store, helper } = context;

  const statements = parser(value, dialect);

  if (resetDiagram) {
    const json = createJson(statements, helper, store.canvasState.database);
    store.dispatchSync(loadJson$(json), sortTable());
  } else {
    var { snapshots } = context;
    snapshots.push(createStoreCopy(store));

    const json = createJson(
      statements,
      helper,
      store.canvasState.database,
      getLatestSnapshot(snapshots)
    );
    store.dispatchSync(loadJson$(json));
  }

  var { snapshots } = context;
  snapshots.push(createStoreCopy(store));
  Logger.log('SNAPSHOTS', snapshots);
}

function checkForChanges(
  newest: ExportedStore,
  snapshot: ExportedStore
): boolean {
  if (
    newest.relationship.relationships.length !=
    snapshot.relationship.relationships.length
  )
    return true;
  if (newest.table.tables.length != snapshot.table.tables.length) return true;

  // todo make more checks for each table and relationship excluding ui changes

  return false;
}

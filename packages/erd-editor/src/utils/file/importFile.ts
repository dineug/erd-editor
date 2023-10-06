import { isString } from '@dineug/shared';

import { AppContext } from '@/components/context';
import { loadJson$ } from '@/engine/modules/editor/generator.actions';

type ImportOptions = {
  type: 'json' | 'sql';
  accept: string;
};

type ImportFileCallback = (options: ImportOptions) => void;

const JSON_EXTENSION = /\.json$/i;
const SQL_EXTENSION = /\.sql$/i;

let performImportFileExtra: ImportFileCallback | null = null;

export function setImportFileCallback(callback: ImportFileCallback | null) {
  performImportFileExtra = callback;
}

export function importJSON({ store }: AppContext) {
  if (performImportFileExtra) {
    performImportFileExtra({ accept: '.json', type: 'json' });
    return;
  }

  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', '.json');
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

    if (!JSON_EXTENSION.test(file.name)) {
      // eventBus.emit(Bus.ToastBar.add, {
      //   bodyTpl: html`Just import the json file`,
      // });
      return;
    }

    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => {
      const value = reader.result;
      if (!isString(value)) {
        return;
      }

      store.dispatch(loadJson$(value));
    };
  });
  input.click();
}

export function importSQLDDL({ store }: AppContext) {
  if (performImportFileExtra) {
    performImportFileExtra({ accept: '.sql', type: 'sql' });
    return;
  }

  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', `.sql`);
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

    if (!SQL_EXTENSION.test(file.name)) {
      // eventBus.emit(Bus.ToastBar.add, {
      //   bodyTpl: html`Just import the sql file`,
      // });
      return;
    }

    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => {
      const value = reader.result;
      if (!isString(value)) {
        return;
      }

      // TODO: DDLParser
      // const statements = DDLParser(value);
      // const json = createJson(statements, helper, store.canvasState.database);
      // store.dispatch(loadJson$(json), sortTable());
    };
  });
  input.click();
}

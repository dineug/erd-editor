import { html } from '@dineug/r-html';
import { isString } from '@dineug/shared';

import { AppContext } from '@/components/appContext';
import Toast from '@/components/primitives/toast/Toast';
import { loadJsonAction$ } from '@/engine/modules/editor/generator.actions';

import { openToastAction } from '../emitter';

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

export function importJSON({ store, emitter }: AppContext) {
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
      emitter.emit(
        openToastAction({
          message: html`<${Toast} description="Just import the json file" />`,
        })
      );
      return;
    }

    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => {
      const value = reader.result;
      if (!isString(value)) {
        return;
      }

      store.dispatch(loadJsonAction$(value));
    };
  });
  input.click();
}

export function importSchemaSQL({ store, emitter }: AppContext) {
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
      emitter.emit(
        openToastAction({
          message: html`<${Toast} description="Just import the sql file" />`,
        })
      );
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
      // const statements = schemaSQLParser(value);
      // const json = createJson(statements, helper, store.canvasState.database);
      // store.dispatch(loadJson$(json), sortTable());
    };
  });
  input.click();
}

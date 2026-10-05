import { isString } from 'es-toolkit';

import { AppContext } from '@/components/appContext';
import Toast from '@/components/primitives/toast/Toast';
import { loadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { openDiffViewerAction, openToastAction } from '@/utils/emitter';
import {
  appendSchemaJSON,
  appendSchemaPlaced,
  importSchemaPlaced,
} from '@/utils/file/importSchema';

/** Whether an import takes the document's place or joins it below the diagram. */
export type ImportMode = 'replace' | 'append';

type ImportOptions = {
  type: 'json' | 'sql' | 'graphql' | 'dbml' | 'aml';
  op: 'set' | 'diff';
  accept: string;
  /** Named only for an append, so a host that knows no mode replaces as before. */
  mode?: ImportMode;
};

type ImportFileCallback = (options: ImportOptions) => void;

const JSON_EXTENSION = /\.json$/i;
const SQL_EXTENSION = /\.sql$/i;
const GRAPHQL_EXTENSION = /\.(graphql|gql|graphqls)$/i;
const GRAPHQL_ACCEPT = '.graphql,.gql,.graphqls';
const DBML_EXTENSION = /\.dbml$/i;
const AML_EXTENSION = /\.aml$/i;

let performImportFileExtra: ImportFileCallback | null = null;

export function setImportFileCallback(callback: ImportFileCallback | null) {
  performImportFileExtra = callback;
}

/** What a host is asked for, the mode named only when it is an append. */
function toImportOptions(
  type: ImportOptions['type'],
  accept: string,
  mode: ImportMode
): ImportOptions {
  return mode === 'append'
    ? { type, op: 'set', accept, mode }
    : { type, op: 'set', accept };
}

/** Lands a schema file read in, replacing the document or joining it as the mode says. */
function landSchema(
  app: AppContext,
  type: Exclude<ImportOptions['type'], 'json'>,
  value: string,
  mode: ImportMode
): Promise<void> {
  return mode === 'append'
    ? appendSchemaPlaced(app, type, value)
    : importSchemaPlaced(app, type, value);
}

export function importJSON(app: AppContext, mode: ImportMode = 'replace') {
  const { store, emitter } = app;

  if (performImportFileExtra) {
    performImportFileExtra(toImportOptions('json', '.json', mode));
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
          message: <Toast description="Just import the json file" />,
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

      if (mode === 'append') {
        appendSchemaJSON(app, value);
      } else {
        store.dispatch(loadJsonAction$(value));
      }
    };
  });
  input.click();
}

export function importSchemaSQL(app: AppContext, mode: ImportMode = 'replace') {
  const { emitter } = app;

  if (performImportFileExtra) {
    performImportFileExtra(toImportOptions('sql', '.sql', mode));
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
          message: <Toast description="Just import the sql file" />,
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

      landSchema(app, 'sql', value, mode);
    };
  });
  input.click();
}

export function importGraphQL(app: AppContext, mode: ImportMode = 'replace') {
  const { emitter } = app;

  if (performImportFileExtra) {
    performImportFileExtra(toImportOptions('graphql', GRAPHQL_ACCEPT, mode));
    return;
  }

  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', GRAPHQL_ACCEPT);
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

    if (!GRAPHQL_EXTENSION.test(file.name)) {
      emitter.emit(
        openToastAction({
          message: <Toast description="Just import the graphql file" />,
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

      landSchema(app, 'graphql', value, mode);
    };
  });
  input.click();
}

export function importDBML(app: AppContext, mode: ImportMode = 'replace') {
  const { emitter } = app;

  if (performImportFileExtra) {
    performImportFileExtra(toImportOptions('dbml', '.dbml', mode));
    return;
  }

  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', '.dbml');
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

    if (!DBML_EXTENSION.test(file.name)) {
      emitter.emit(
        openToastAction({
          message: <Toast description="Just import the dbml file" />,
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

      landSchema(app, 'dbml', value, mode);
    };
  });
  input.click();
}

export function importAML(app: AppContext, mode: ImportMode = 'replace') {
  const { emitter } = app;

  if (performImportFileExtra) {
    performImportFileExtra(toImportOptions('aml', '.aml', mode));
    return;
  }

  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', '.aml');
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

    if (!AML_EXTENSION.test(file.name)) {
      emitter.emit(
        openToastAction({
          message: <Toast description="Just import the aml file" />,
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

      landSchema(app, 'aml', value, mode);
    };
  });
  input.click();
}

export function importDiffJSON({ emitter }: AppContext) {
  if (performImportFileExtra) {
    performImportFileExtra({
      type: 'json',
      op: 'diff',
      accept: '.json',
    });
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
          message: <Toast description="Just import the json file" />,
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

      emitter.emit(openDiffViewerAction({ value }));
    };
  });
  input.click();
}

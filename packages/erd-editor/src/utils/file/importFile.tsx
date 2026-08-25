import { isString } from '@dineug/shared';

import { AppContext } from '@/components/appContext';
import Toast from '@/components/primitives/toast/Toast';
import {
  loadJsonAction$,
  loadSchemaAMLAction$,
  loadSchemaDBMLAction$,
  loadSchemaGraphQLAction$,
  loadSchemaSQLAction$,
} from '@/engine/modules/editor/generator.actions';
import { openDiffViewerAction, openToastAction } from '@/utils/emitter';

type ImportOptions = {
  type: 'json' | 'sql' | 'graphql' | 'dbml' | 'aml';
  op: 'set' | 'diff';
  accept: string;
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

export function importJSON({ store, emitter }: AppContext) {
  if (performImportFileExtra) {
    performImportFileExtra({
      type: 'json',
      op: 'set',
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

      store.dispatch(loadJsonAction$(value));
    };
  });
  input.click();
}

export function importSchemaSQL({ store, emitter }: AppContext) {
  if (performImportFileExtra) {
    performImportFileExtra({ type: 'sql', op: 'set', accept: '.sql' });
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

      store.dispatch(loadSchemaSQLAction$(value));
    };
  });
  input.click();
}

export function importGraphQL({ store, emitter }: AppContext) {
  if (performImportFileExtra) {
    performImportFileExtra({
      type: 'graphql',
      op: 'set',
      accept: GRAPHQL_ACCEPT,
    });
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

      store.dispatch(loadSchemaGraphQLAction$(value));
    };
  });
  input.click();
}

export function importDBML({ store, emitter }: AppContext) {
  if (performImportFileExtra) {
    performImportFileExtra({
      type: 'dbml',
      op: 'set',
      accept: '.dbml',
    });
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

      store.dispatch(loadSchemaDBMLAction$(value));
    };
  });
  input.click();
}

export function importAML({ store, emitter }: AppContext) {
  if (performImportFileExtra) {
    performImportFileExtra({
      type: 'aml',
      op: 'set',
      accept: '.aml',
    });
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

      store.dispatch(loadSchemaAMLAction$(value));
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

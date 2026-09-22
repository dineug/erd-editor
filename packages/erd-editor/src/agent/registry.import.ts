import { parser } from '@dineug/erd-editor-schema';
import { isPlainObject } from 'es-toolkit';
import { isEmpty } from 'es-toolkit/compat';

import type { ActionTool, ToolArg } from '@/agent/registry';
import type { GeneratorAction } from '@/engine/generator.actions';
import {
  loadJsonAction$,
  loadSchemaAMLAction$,
  loadSchemaDBMLAction$,
  loadSchemaGraphQLAction$,
  loadSchemaSQLAction$,
} from '@/engine/modules/editor/generator.actions';
import { toSafeString } from '@/utils/validation';

const VALUE: readonly ToolArg[] = [
  { name: 'value', kind: { type: 'string' }, required: true },
];

const DOCUMENT_PATHS = ['tables', 'relationships', 'indexes', 'memos'];

/**
 * A schema import, as the element's setters run it: the parsed document
 * replaces the current one, the settings but the view are kept, and the tables
 * are laid out anew. The text is trimmed, and an empty one refused, as there.
 */
const schemaTool = (
  name: string,
  load$: (value: string) => GeneratorAction
): ActionTool => ({
  name,
  kind: 'generator',
  actionTypes: ['editor.clear', 'editor.loadJson', 'table.sort'],
  undoable: true,
  stream: false,
  expectedBatches: 1,
  expectedHistory: 1,
  snapshotPaths: DOCUMENT_PATHS,
  args: VALUE,
  refine: ({ value }) =>
    isEmpty(toSafeString(value))
      ? 'value is empty, so nothing was imported'
      : undefined,
  toActions: ({ value }) => [load$(toSafeString(value))],
});

/**
 * Whether the load reducer can take the text: it parses it as the element's
 * value setter hands it over, and a text it throws on would leave the document
 * cleared, so the call is refused before anything is dispatched.
 */
function refuseDocument(value: string): string | undefined {
  if (isEmpty(value)) return;

  try {
    if (!isPlainObject(JSON.parse(value))) {
      return 'value must be a JSON object, an erd-editor document';
    }
    parser(value);
  } catch (error) {
    return `value is not an erd-editor document: ${(error as Error).message}`;
  }
}

export const importTools: readonly ActionTool[] = [
  schemaTool('erd_import_sql', loadSchemaSQLAction$),
  schemaTool('erd_import_graphql', loadSchemaGraphQLAction$),
  schemaTool('erd_import_dbml', loadSchemaDBMLAction$),
  schemaTool('erd_import_aml', loadSchemaAMLAction$),
  {
    name: 'erd_import_json',
    kind: 'generator',
    actionTypes: ['editor.clear', 'editor.loadJson'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['settings', ...DOCUMENT_PATHS],
    args: VALUE,
    refine: ({ value }) => refuseDocument(value),
    // The element's value setter loads an empty text as an empty document.
    toActions: ({ value }) => [loadJsonAction$(isEmpty(value) ? '{}' : value)],
  },
];

import {
  type ActionType,
  editorActions$,
  type GeneratorAction,
} from '@dineug/erd-editor/peer.js';
import { createSchema, parser, toJson } from '@dineug/erd-editor-schema';
import { isPlainObject, isString } from 'es-toolkit';
import { isEmpty } from 'es-toolkit/compat';

import type { ActionTool, ToolArg, ToolArgValues } from '@/tools/registry';

/** Whether an import takes the document's place or joins it, the default a replace. */
const ImportMode = { replace: 'replace', append: 'append' } as const;

const ARGS: readonly ToolArg[] = [
  { name: 'value', kind: { type: 'string' }, required: true },
  { name: 'mode', kind: { type: 'enum', values: ImportMode }, required: false },
];

const DOCUMENT_PATHS = ['tables', 'relationships', 'indexes', 'memos'];

/**
 * What an append adds, the entities of a paste: every table with its columns,
 * the relationships and indexes between them and, from a document, its memos.
 * A field left at what a new entity starts with is not sent.
 */
const APPEND_TYPES: readonly ActionType[] = [
  'table.add',
  'table.changeName',
  'table.changeComment',
  'column.add',
  'column.changeName',
  'column.changeDataType',
  'column.changeDefault',
  'column.changeComment',
  'column.changePrimaryKey',
  'column.changeNotNull',
  'column.changeUnique',
  'column.changeAutoIncrement',
  'relationship.add',
  'index.add',
  'index.changeName',
  'index.changeUnique',
  'indexColumn.add',
  'indexColumn.changeOrderType',
];

/** What an append adds for the table groups a document brings, with their tables. */
const GROUP_APPEND_TYPES: readonly ActionType[] = [
  'tableGroup.add',
  'tableGroup.changeName',
  'table.changeGroup',
];

/** The text an import loads, trimmed, as the element's value setter takes it. */
const toSafeString = (value: any): string =>
  isString(value) ? value.trim() : '';

const isAppend = ({ mode }: ToolArgValues) => mode === ImportMode.append;

/**
 * A schema import, as the element's setters run it: the parsed document replaces
 * the current one, its settings but the view kept, or with mode append joins it in
 * the grid below its tables. The text is trimmed, and an empty one refused.
 */
const schemaTool = (
  name: string,
  type: 'sql' | 'graphql' | 'dbml' | 'aml',
  load$: (value: string) => GeneratorAction,
  extraAppendTypes: readonly ActionType[] = []
): ActionTool => ({
  name,
  kind: 'generator',
  actionTypes: [
    'editor.clear',
    'editor.loadJson',
    'table.sort',
    ...APPEND_TYPES,
    ...extraAppendTypes,
  ],
  undoable: true,
  stream: false,
  // An append of a text that declares no table sends nothing.
  expectedBatches: { min: 0, max: 1 },
  expectedHistory: { min: 0, max: 1 },
  snapshotPaths: DOCUMENT_PATHS,
  args: ARGS,
  refine: ({ value }) =>
    isEmpty(toSafeString(value))
      ? 'value is empty, so nothing was imported'
      : undefined,
  toActions: args => {
    const value = toSafeString(args.value);
    return [
      isAppend(args)
        ? editorActions$.appendSchemaAction$(type, value)
        : load$(value),
    ];
  },
});

/**
 * Whether the load reducer can take the text, refused before anything is sent
 * where it would throw and leave the document cleared, and for an append of an
 * empty text, which would add nothing.
 */
function refuseDocument(value: string, append: boolean): string | undefined {
  if (isEmpty(value)) {
    return append ? 'value is empty, so nothing was imported' : undefined;
  }

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
  schemaTool('erd_import_sql', 'sql', editorActions$.loadSchemaSQLAction$),
  schemaTool(
    'erd_import_graphql',
    'graphql',
    editorActions$.loadSchemaGraphQLAction$
  ),
  schemaTool(
    'erd_import_dbml',
    'dbml',
    editorActions$.loadSchemaDBMLAction$,
    GROUP_APPEND_TYPES
  ),
  schemaTool('erd_import_aml', 'aml', editorActions$.loadSchemaAMLAction$),
  {
    name: 'erd_import_json',
    kind: 'generator',
    actionTypes: [
      'editor.clear',
      'editor.loadJson',
      ...APPEND_TYPES,
      'memo.add',
      'memo.changeValue',
      ...GROUP_APPEND_TYPES,
    ],
    undoable: true,
    stream: false,
    // An append of a document holding no table and no memo sends nothing.
    expectedBatches: { min: 0, max: 1 },
    expectedHistory: { min: 0, max: 1 },
    snapshotPaths: ['settings', ...DOCUMENT_PATHS],
    args: ARGS,
    refine: args => refuseDocument(args.value, isAppend(args)),
    // The element's value setter loads an empty text as a new document.
    toActions: args =>
      isAppend(args)
        ? [editorActions$.appendSchemaJsonAction$(args.value)]
        : [
            editorActions$.loadJsonAction$(
              isEmpty(args.value) ? toJson(createSchema()) : args.value
            ),
          ],
  },
];

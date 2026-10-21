import {
  dictionaryActions$,
  type GeneratorAction,
  type RootState,
  validateDictionaryValues,
} from '@dineug/erd-editor/peer.js';
import { compareByOrder, query } from '@dineug/erd-editor-schema';

import type { ActionTool, ToolArg, ToolArgValues } from '@/tools/registry';

type DictionaryKind = Parameters<
  typeof dictionaryActions$.removeDictionaryEntriesAction$
>[0];

type DictionaryRefusal = ReturnType<typeof validateDictionaryValues>[number];

/** The id argument of each dictionary's rows, and the snapshot list holding them. */
const ID_ARG = { word: 'wordId', term: 'termId', domain: 'domainId' } as const;
const LIST = { word: 'words', term: 'terms', domain: 'domains' } as const;

/**
 * The string fields a tool writes into a row, in the order a sheet shows them,
 * each with whether an add must name it. A term's domain is set apart, since it
 * comes by id or by name.
 */
const FIELDS: Record<
  DictionaryKind,
  ReadonlyArray<readonly [name: string, requiredOnAdd: boolean]>
> = {
  word: [
    ['name', true],
    ['abbreviation', true],
    ['englishName', false],
    ['description', false],
    ['synonyms', false],
    ['forbiddenWords', false],
  ],
  term: [
    ['name', true],
    ['physicalName', false],
    ['description', false],
    ['synonyms', false],
  ],
  domain: [
    ['name', true],
    ['category', false],
    ['dataType', true],
    ['description', false],
  ],
};

/** A domain by id, null or '' for none, or by its name, '' for none. */
export const DOMAIN_ARGS: readonly ToolArg[] = [
  {
    name: 'domainId',
    kind: { type: 'entityId', entity: 'domain', orNone: true },
    required: false,
  },
  { name: 'domainName', kind: { type: 'string' }, required: false },
];

const idArg = (kind: DictionaryKind): ToolArg => ({
  name: ID_ARG[kind],
  kind: { type: 'entityId', entity: kind },
  required: true,
});

const fieldArgs = (kind: DictionaryKind, add: boolean): ToolArg[] => {
  const args: ToolArg[] = FIELDS[kind].map(([name, requiredOnAdd]) => ({
    name,
    kind: { type: 'string' },
    required: add && requiredOnAdd,
  }));
  if (kind === 'term') args.splice(2, 0, ...DOMAIN_ARGS);
  return args;
};

const normalizeName = (name: string) => name.trim().normalize('NFC');

/**
 * The listed domain a name gives, compared trimmed and composed as the editor
 * compares one, the first in the sheet's order; '' for a blank name and
 * undefined for a name no listed domain holds.
 */
export function domainIdByName(
  state: RootState,
  name: string
): string | undefined {
  const key = normalizeName(name);
  if (!key) return '';

  // The first in the order the sheet shows, as the editor's domain cell reads.
  return query(state.collections)
    .collection('domainEntities')
    .selectByIds(state.doc.domainIds)
    .sort(compareByOrder)
    .find(domain => normalizeName(domain.name) === key)?.id;
}

/** The domain a call links, by name or by id; undefined where it names none. */
export const domainOf = (
  { domainId, domainName }: ToolArgValues,
  state: RootState
): string | undefined =>
  domainName === undefined ? domainId : domainIdByName(state, domainName);

/** Refuses a domain given both ways, or by a name no listed domain holds. */
export function refineDomain(
  args: ToolArgValues,
  state: RootState
): string | undefined {
  if (args.domainId !== undefined && args.domainName !== undefined) {
    return 'pass domainId or domainName, not both';
  }
  return args.domainName !== undefined &&
    domainIdByName(state, args.domainName) === undefined
    ? `domainName ${JSON.stringify(args.domainName)} names no domain of the document`
    : undefined;
}

/** The values a call writes into a row: the fields it names, a term's domain resolved. */
function valuesOf(
  kind: DictionaryKind,
  args: ToolArgValues,
  state: RootState
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name] of FIELDS[kind]) {
    if (typeof args[name] === 'string') values[name] = args[name];
  }
  if (kind === 'term') {
    const domainId = domainOf(args, state);
    if (domainId !== undefined) values.domainId = domainId;
  }
  return values;
}

const refusalMessage = (
  kind: DictionaryKind,
  { code, name, value }: DictionaryRefusal
): string =>
  ({
    duplicateName: `name ${JSON.stringify(name)} is another ${kind}'s already; a dictionary holds each name once`,
    unknownDomain: `domainId ${value} names no live domain`,
  })[code];

/**
 * A write the editor's sheet would refuse: a name another row of the sheet
 * holds, compared as the editor compares names, or an unknown domain; an
 * update must also name a field.
 */
const refineEntry =
  (kind: DictionaryKind, update: boolean) =>
  (args: ToolArgValues, state: RootState): string | undefined => {
    const domainRefusal = kind === 'term' && refineDomain(args, state);
    if (domainRefusal) return domainRefusal;

    const values = valuesOf(kind, args, state);
    if (update && !Object.keys(values).length) {
      return `pass at least one field to change: ${fieldArgs(kind, false)
        .map(({ name }) => name)
        .join(', ')}`;
    }

    const [refusal] = validateDictionaryValues(state, kind, [
      { id: update ? args[ID_ARG[kind]] : undefined, values },
    ]);
    return refusal && refusalMessage(kind, refusal);
  };

/** A term's domain name is read as the call runs, as the editor's sheet reads one. */
const addEntryAction$ = (
  kind: DictionaryKind,
  args: ToolArgValues
): GeneratorAction =>
  function* (state) {
    yield dictionaryActions$.addDictionaryEntryAction$(
      kind,
      valuesOf(kind, args, state)
    );
  };

const updateEntryAction$ = (
  kind: DictionaryKind,
  args: ToolArgValues
): GeneratorAction =>
  function* (state) {
    yield dictionaryActions$.updateDictionaryEntryAction$(
      kind,
      args[ID_ARG[kind]],
      valuesOf(kind, args, state)
    );
  };

const addTool = (name: string, kind: DictionaryKind): ActionTool => ({
  name,
  kind: 'generator',
  actionTypes: ['dictionary.add'],
  undoable: true,
  stream: false,
  expectedBatches: 1,
  expectedHistory: 1,
  snapshotPaths: [LIST[kind]],
  args: fieldArgs(kind, true),
  refine: refineEntry(kind, false),
  toActions: args => [addEntryAction$(kind, args)],
});

const updateTool = (
  name: string,
  kind: DictionaryKind,
  more: Pick<ActionTool, 'actionTypes' | 'snapshotPaths'> = {
    actionTypes: [],
    snapshotPaths: [],
  }
): ActionTool => ({
  name,
  kind: 'generator',
  actionTypes: ['dictionary.update', ...more.actionTypes],
  undoable: true,
  stream: false,
  // Only the fields that change are sent, so a call naming none sends nothing.
  expectedBatches: { min: 0, max: 1 },
  expectedHistory: { min: 0, max: 1 },
  snapshotPaths: [`${LIST[kind]}[${ID_ARG[kind]}]`, ...more.snapshotPaths],
  args: [idArg(kind), ...fieldArgs(kind, false)],
  refine: refineEntry(kind, true),
  toActions: args => [updateEntryAction$(kind, args)],
});

const removeTool = (name: string, kind: DictionaryKind): ActionTool => ({
  name,
  kind: 'generator',
  actionTypes: ['dictionary.remove'],
  undoable: true,
  stream: false,
  expectedBatches: 1,
  expectedHistory: 1,
  snapshotPaths: [LIST[kind]],
  args: [idArg(kind)],
  toActions: args => [
    dictionaryActions$.removeDictionaryEntriesAction$(kind, [
      args[ID_ARG[kind]],
    ]),
  ],
});

export const dictionaryTools: readonly ActionTool[] = [
  addTool('erd_add_word', 'word'),
  updateTool('erd_update_word', 'word'),
  removeTool('erd_remove_word', 'word'),
  addTool('erd_add_term', 'term'),
  updateTool('erd_update_term', 'term'),
  removeTool('erd_remove_term', 'term'),
  addTool('erd_add_domain', 'domain'),
  // A new data type reaches every column linking the domain, through the data
  // type sync too, and unlinks a column the sync leaves off its own domain.
  updateTool('erd_update_domain', 'domain', {
    actionTypes: ['column.changeDataType', 'column.changeDomain'],
    snapshotPaths: ['tables'],
  }),
  removeTool('erd_remove_domain', 'domain'),
];

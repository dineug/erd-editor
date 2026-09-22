import type {
  ActionTool,
  ToolArg,
  ToolArgValues,
  ToolEntity,
} from '@dineug/erd-editor/agent.js';
import type { RootState } from '@dineug/erd-editor/peer.js';
import { isPlainObject } from 'es-toolkit';

import { ToolError, ToolErrorCode } from '@/tools/errors';

type Tool = Pick<ActionTool, 'name' | 'args' | 'refine'>;

const ENTITY_LABEL: Record<ToolEntity, string> = {
  table: 'table',
  column: 'column',
  relationship: 'relationship',
  index: 'index',
  indexColumn: 'index column',
  memo: 'memo',
};

const typeName = (value: unknown) =>
  value === null ? 'null' : Array.isArray(value) ? 'an array' : typeof value;

const liveTable = ({ doc, collections }: RootState, id: string) =>
  doc.tableIds.includes(id) ? collections.tableEntities[id] : undefined;

const liveIndex = ({ doc, collections }: RootState, id: string) =>
  doc.indexIds.includes(id) ? collections.indexEntities[id] : undefined;

/**
 * Whether an id names an entity the document still shows. A removed entity
 * keeps its record as an LWW tombstone, so a record alone proves nothing;
 * membership in the live id lists does.
 */
function isLive(
  state: RootState,
  entity: ToolEntity,
  id: string,
  parent?: { entity: ToolEntity; id: string }
): boolean {
  const { doc } = state;

  switch (entity) {
    case 'table':
      return doc.tableIds.includes(id);
    case 'relationship':
      return doc.relationshipIds.includes(id);
    case 'index':
      return doc.indexIds.includes(id);
    case 'memo':
      return doc.memoIds.includes(id);
    case 'column': {
      if (!parent) {
        return doc.tableIds.some(tableId =>
          liveTable(state, tableId)?.columnIds.includes(id)
        );
      }
      // Under an index, a column is one of the table the index belongs to.
      const tableId =
        parent.entity === 'index'
          ? liveIndex(state, parent.id)?.tableId
          : parent.id;
      return Boolean(
        tableId && liveTable(state, tableId)?.columnIds.includes(id)
      );
    }
    case 'indexColumn':
      return parent === undefined
        ? doc.indexIds.some(indexId =>
            liveIndex(state, indexId)?.indexColumnIds.includes(id)
          )
        : Boolean(liveIndex(state, parent.id)?.indexColumnIds.includes(id));
  }
}

function invalid(tool: Tool, message: string): ToolError {
  return new ToolError(ToolErrorCode.invalidArgs, tool.name, message);
}

/** The value an argument carries once its shape is right, before liveness. */
function checkShape(tool: Tool, arg: ToolArg, value: unknown): unknown {
  const { kind, name } = arg;

  switch (kind.type) {
    case 'string':
      if (typeof value !== 'string') {
        throw invalid(tool, `${name} must be a string, got ${typeName(value)}`);
      }
      return value;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw invalid(tool, `${name} must be a finite number`);
      }
      return value;
    case 'integer':
      if (!Number.isInteger(value)) {
        throw invalid(tool, `${name} must be an integer`);
      }
      return value;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw invalid(tool, `${name} must be true or false`);
      }
      return value;
    case 'enum': {
      const names = Object.keys(kind.values);
      if (typeof value !== 'string' || !names.includes(value)) {
        throw invalid(tool, `${name} must be one of ${names.join(', ')}`);
      }
      return kind.values[value];
    }
    case 'entityId':
      if (typeof value !== 'string' || !value) {
        throw invalid(
          tool,
          `${name} must be a ${ENTITY_LABEL[kind.entity]} id`
        );
      }
      return value;
    case 'entityIdList':
      if (
        !Array.isArray(value) ||
        !value.length ||
        value.some(id => typeof id !== 'string' || !id)
      ) {
        throw invalid(
          tool,
          `${name} must be a non-empty list of ${ENTITY_LABEL[kind.entity]} ids`
        );
      }
      return [...new Set(value as string[])];
  }
}

function checkLive(
  tool: Tool,
  arg: ToolArg,
  value: unknown,
  values: Record<string, unknown>,
  state: RootState
) {
  const { kind, name } = arg;
  if (kind.type !== 'entityId' && kind.type !== 'entityIdList') return;

  const parentArg = kind.parentArg
    ? tool.args.find(({ name }) => name === kind.parentArg)
    : undefined;
  const parent =
    parentArg?.kind.type === 'entityId'
      ? {
          entity: parentArg.kind.entity,
          id: values[parentArg.name] as string,
        }
      : undefined;
  const ids =
    kind.type === 'entityId' ? [value as string] : (value as string[]);
  const label = ENTITY_LABEL[kind.entity];

  for (const id of ids) {
    if (isLive(state, kind.entity, id, parent)) continue;

    const where = !parent
      ? ''
      : parent.entity === 'index' && kind.entity === 'column'
        ? ` in the table of ${kind.parentArg} ${parent.id}`
        : ` in ${kind.parentArg} ${parent.id}`;
    throw new ToolError(
      ToolErrorCode.notFound,
      tool.name,
      `${name} ${id} names no live ${label}${where}; read the document for current ids`
    );
  }
}

/**
 * Checks a call's arguments against the tool's list and the document, and
 * returns them ready for toActions. Every refusal throws before anything is
 * dispatched, so a bad call leaves no trace in the document or on a peer.
 */
export function validateToolArgs(
  tool: Tool,
  args: unknown,
  state: RootState
): ToolArgValues {
  const input = args ?? {};
  if (!isPlainObject(input)) {
    throw invalid(tool, `arguments must be an object, got ${typeName(args)}`);
  }

  const record = input as Record<string, unknown>;
  const accepted = tool.args.map(({ name }) => name);
  const unknown = Object.keys(record).filter(key => !accepted.includes(key));
  if (unknown.length) {
    const expected = accepted.length ? accepted.join(', ') : 'none';
    throw invalid(
      tool,
      `unexpected argument ${unknown.join(', ')}; accepted: ${expected}`
    );
  }

  const values: Record<string, unknown> = {};

  for (const arg of tool.args) {
    const value = record[arg.name];
    if (value === undefined) {
      if (arg.required) throw invalid(tool, `${arg.name} is required`);
      continue;
    }

    values[arg.name] = checkShape(tool, arg, value);
  }

  // Parents first: a column is looked up in the table its parent argument
  // names, which is only meaningful once that table is known to be live.
  const ordered = [...tool.args].sort(
    (a, b) => Number(hasParent(a)) - Number(hasParent(b))
  );
  for (const arg of ordered) {
    if (arg.name in values) {
      checkLive(tool, arg, values[arg.name], values, state);
    }
  }

  const refusal = tool.refine?.(values);
  if (refusal) throw invalid(tool, refusal);

  return Object.freeze(values);
}

const hasParent = ({ kind }: ToolArg) =>
  (kind.type === 'entityId' || kind.type === 'entityIdList') &&
  Boolean(kind.parentArg);

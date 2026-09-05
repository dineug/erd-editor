import { isNotNil } from 'es-toolkit';
import {
  DirectiveNode,
  DocumentNode,
  FieldDefinitionNode,
  Kind,
  Location,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  parse,
  StringValueNode,
  TokenKind,
  TypeNode,
  ValueNode,
} from 'graphql';

import {
  GraphQLField,
  GraphQLIndex,
  GraphQLModel,
  GraphQLParseResult,
  GraphQLTable,
  GraphQLTypeRef,
} from './types';

const DEFAULT_ROOT_TYPE_NAMES = ['Query', 'Mutation', 'Subscription'];
const INTROSPECTION_PREFIX = '__';
const RELAY_TYPE_NAMES = ['PageInfo'];
const RELAY_SUFFIXES = ['Connection', 'Edge'];
const HASURA_SUFFIXES = [
  '_aggregate',
  '_aggregate_fields',
  '_mutation_response',
  '_max_fields',
  '_min_fields',
  '_sum_fields',
  '_avg_fields',
  '_stddev_fields',
  '_variance_fields',
  '_bool_exp',
  '_order_by',
  '_insert_input',
  '_set_input',
  '_on_conflict',
  '_constraint',
  '_update_column',
  '_select_column',
];
const FEDERATION_TYPE_NAMES = ['_Service', '_Entity', '_Any', '_FieldSet'];
const DB_DIRECTIVE_PREFIX = 'db_';
const AUTO_INCREMENT_DEFAULTS = ['autoincrement', 'autoincrement()'];

const NAME_START = /[_A-Za-z]/;
const NAME_PART = /[_0-9A-Za-z]/;

type ObjectDraft = {
  name: string;
  comment: string;
  interfaceNames: string[];
  fieldNodes: FieldDefinitionNode[];
  directives: DirectiveNode[];
};

type SourceLocation = { line: number; column: number };

export function parseGraphQLModel(sdl: string): GraphQLParseResult {
  try {
    return { ok: true, model: toModel(parseDocument(sdl)) };
  } catch (error) {
    return { ok: false, message: toErrorMessage(error) };
  }
}

function parseDocument(sdl: string): DocumentNode {
  try {
    return parse(sdl);
  } catch (error) {
    const sanitized = sanitizePrismaDirectives(sdl);
    if (sanitized === sdl) throw error;

    try {
      return parse(sanitized);
    } catch {
      // The user only ever sees the text they picked, so the positions worth
      // reporting are the ones measured against it.
      throw error;
    }
  }
}

function toErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const location = (error as { locations?: ReadonlyArray<SourceLocation> })
    ?.locations?.[0];
  if (!location) return message;

  const description = message.replace(/^Syntax Error:\s*/, '');
  return `Syntax Error at line ${location.line}, column ${location.column}: ${description}`;
}

function toModel(document: DocumentNode): GraphQLModel {
  const enums: Record<string, string[]> = {};
  const unions: Record<string, string[]> = {};
  const customScalars: string[] = [];
  const interfaceFields = new Map<string, FieldDefinitionNode[]>();
  const drafts = new Map<string, ObjectDraft>();
  const declaredRootTypeNames = new Set<string>();

  for (const definition of document.definitions) {
    switch (definition.kind) {
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_EXTENSION:
        mergeObject(drafts, definition);
        break;
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.INTERFACE_TYPE_EXTENSION: {
        const name = definition.name.value;
        const fields = interfaceFields.get(name) ?? [];
        fields.push(...(definition.fields ?? []));
        interfaceFields.set(name, fields);
        break;
      }
      case Kind.SCHEMA_DEFINITION:
      case Kind.SCHEMA_EXTENSION:
        for (const operationType of definition.operationTypes ?? []) {
          declaredRootTypeNames.add(operationType.type.name.value);
        }
        break;
      case Kind.ENUM_TYPE_DEFINITION:
        enums[definition.name.value] = (definition.values ?? []).map(
          value => value.name.value
        );
        break;
      case Kind.UNION_TYPE_DEFINITION:
        unions[definition.name.value] = (definition.types ?? []).map(
          type => type.name.value
        );
        break;
      case Kind.SCALAR_TYPE_DEFINITION:
        customScalars.push(definition.name.value);
        break;
    }
  }

  const rootTypeNames = declaredRootTypeNames.size
    ? declaredRootTypeNames
    : new Set(DEFAULT_ROOT_TYPE_NAMES);
  const tables: GraphQLTable[] = [];
  const skipped: string[] = [];
  const renamed = new Map<string, string>();

  for (const draft of drafts.values()) {
    if (isNoiseTypeName(draft.name, rootTypeNames)) {
      skipped.push(draft.name);
      continue;
    }

    const table = toTable(draft, interfaceFields);
    if (!table.fields.length) {
      skipped.push(draft.name);
      continue;
    }

    if (table.name !== draft.name) {
      renamed.set(draft.name, table.name);
    }
    tables.push(table);
  }

  applyTableRenames(tables, renamed);

  return { tables, enums, customScalars, unions, skipped };
}

/**
 * A field keeps naming the GraphQL type after @map / @table renamed its
 * table, and convert.ts recognises a reference field by table.name alone --
 * left unmapped, every relation field is read as a scalar column instead.
 */
function applyTableRenames(
  tables: GraphQLTable[],
  renamed: Map<string, string>
) {
  if (!renamed.size) return;

  for (const table of tables) {
    for (const field of table.fields) {
      const name = renamed.get(field.typeRef.named);
      if (name) {
        field.typeRef.named = name;
      }
    }
  }
}

function mergeObject(
  drafts: Map<string, ObjectDraft>,
  node: ObjectTypeDefinitionNode | ObjectTypeExtensionNode
) {
  const name = node.name.value;
  const interfaceNames = (node.interfaces ?? []).map(
    interfaceNode => interfaceNode.name.value
  );
  const draft = drafts.get(name);

  if (draft) {
    draft.fieldNodes.push(...(node.fields ?? []));
    draft.interfaceNames.push(...interfaceNames);
    draft.directives.push(...(node.directives ?? []));
    if (!draft.comment) {
      draft.comment = describe(node);
    }
    return;
  }

  drafts.set(name, {
    name,
    comment: describe(node),
    interfaceNames,
    fieldNodes: [...(node.fields ?? [])],
    directives: [...(node.directives ?? [])],
  });
}

function toTable(
  draft: ObjectDraft,
  interfaceFields: Map<string, FieldDefinitionNode[]>
): GraphQLTable {
  const ownFieldNodes = dedupeByName(draft.fieldNodes);
  const seen = new Set(ownFieldNodes.map(node => node.name.value));
  const inheritedFieldNodes: FieldDefinitionNode[] = [];

  for (const interfaceName of draft.interfaceNames) {
    for (const node of interfaceFields.get(interfaceName) ?? []) {
      const name = node.name.value;
      if (seen.has(name)) continue;

      seen.add(name);
      inheritedFieldNodes.push(node);
    }
  }

  const table: GraphQLTable = {
    name: draft.name,
    comment: draft.comment,
    fields: [...inheritedFieldNodes, ...ownFieldNodes]
      .map(toField)
      .filter(isNotNil),
    indexes: [],
  };

  for (const directive of draft.directives) {
    applyTableDirective(table, directive);
  }

  return table;
}

function dedupeByName(nodes: FieldDefinitionNode[]): FieldDefinitionNode[] {
  const seen = new Set<string>();
  return nodes.filter(node => {
    const name = node.name.value;
    if (seen.has(name)) return false;

    seen.add(name);
    return true;
  });
}

function toField(node: FieldDefinitionNode): GraphQLField | null {
  if (node.name.value.startsWith(INTROSPECTION_PREFIX)) return null;

  const field: GraphQLField = {
    name: node.name.value,
    comment: describe(node),
    typeRef: toTypeRef(node.type),
    primaryKey: false,
    unique: false,
    autoIncrement: false,
    default: '',
    dataType: '',
    relationName: '',
    relationFields: [],
    relationReferences: [],
    hasArguments: (node.arguments ?? []).length > 0,
  };

  for (const directive of node.directives ?? []) {
    applyFieldDirective(field, directive);
  }

  return field;
}

function toTypeRef(node: TypeNode): GraphQLTypeRef {
  const nonNull = node.kind === Kind.NON_NULL_TYPE;
  const unwrapped = nonNull ? node.type : node;
  const isList = unwrapped.kind === Kind.LIST_TYPE;
  const item = isList ? unwrapped.type : unwrapped;
  const itemNonNull = isList && item.kind === Kind.NON_NULL_TYPE;

  let named: TypeNode = item;
  while (named.kind !== Kind.NAMED_TYPE) {
    named = named.type;
  }

  return { named: named.name.value, nonNull, isList, itemNonNull };
}

function applyFieldDirective(field: GraphQLField, directive: DirectiveNode) {
  const name = directive.name.value;

  if (name.startsWith(DB_DIRECTIVE_PREFIX)) {
    field.dataType = toDbDataType(name, directive);
    return;
  }

  switch (name) {
    case 'id':
    case 'primaryKey':
      field.primaryKey = true;
      break;
    case 'unique':
      field.unique = true;
      break;
    case 'autoincrement':
    case 'autoIncrement':
      field.autoIncrement = true;
      break;
    case 'default': {
      const value = argumentOf(directive, 'value');
      if (!value) break;

      const text = valueToString(value);
      if (AUTO_INCREMENT_DEFAULTS.includes(text.toLowerCase())) {
        field.autoIncrement = true;
      } else {
        field.default = text;
      }
      break;
    }
    case 'map': {
      const mapped =
        stringArgument(directive, 'name') || stringArgument(directive, 'value');
      if (mapped) {
        field.name = mapped;
      }
      break;
    }
    case 'relation': {
      const relationName =
        stringArgument(directive, 'name') || stringArgument(directive, 'value');
      if (relationName) {
        field.relationName = relationName;
      }

      const fields = argumentOf(directive, 'fields');
      if (fields) {
        field.relationFields = valueToList(fields);
      }

      const references = argumentOf(directive, 'references');
      if (references) {
        field.relationReferences = valueToList(references);
      }
      break;
    }
    case 'column': {
      const mapped = stringArgument(directive, 'name');
      if (mapped) {
        field.name = mapped;
      }

      const dataType = stringArgument(directive, 'dataType');
      if (dataType) {
        field.dataType = dataType;
      }

      const defaultValue = argumentOf(directive, 'default');
      if (defaultValue) {
        field.default = valueToString(defaultValue);
      }

      const autoIncrement = booleanArgument(directive, 'autoIncrement');
      if (autoIncrement !== null) {
        field.autoIncrement = autoIncrement;
      }

      const unique = booleanArgument(directive, 'unique');
      if (unique !== null) {
        field.unique = unique;
      }

      const primaryKey = booleanArgument(directive, 'primaryKey');
      if (primaryKey !== null) {
        field.primaryKey = primaryKey;
      }
      break;
    }
  }
}

function applyTableDirective(table: GraphQLTable, directive: DirectiveNode) {
  switch (directive.name.value) {
    case 'map': {
      const mapped =
        stringArgument(directive, 'name') || stringArgument(directive, 'value');
      if (mapped) {
        table.name = mapped;
      }
      break;
    }
    case 'table': {
      const name = stringArgument(directive, 'name');
      if (name) {
        table.name = name;
      }

      const comment = argumentOf(directive, 'comment');
      if (comment) {
        table.comment = valueToString(comment);
      }
      break;
    }
    case 'index': {
      const fields = argumentOf(directive, 'fields');
      const fieldNames = fields ? valueToList(fields) : [];
      if (!fieldNames.length) break;

      const index: GraphQLIndex = {
        name: stringArgument(directive, 'name'),
        unique: booleanArgument(directive, 'unique') ?? false,
        fieldNames,
      };
      table.indexes.push(index);
      break;
    }
  }
}

function toDbDataType(name: string, directive: DirectiveNode): string {
  const dataType = name.slice(DB_DIRECTIVE_PREFIX.length);
  const args = directive.arguments ?? [];
  if (!args.length) return dataType;

  return `${dataType}(${args.map(argument => valueToString(argument.value)).join(', ')})`;
}

function argumentOf(directive: DirectiveNode, name: string): ValueNode | null {
  const argument = (directive.arguments ?? []).find(
    argument => argument.name.value === name
  );
  return argument ? argument.value : null;
}

function stringArgument(directive: DirectiveNode, name: string): string {
  const value = argumentOf(directive, name);
  return value ? valueToString(value) : '';
}

function booleanArgument(
  directive: DirectiveNode,
  name: string
): boolean | null {
  const value = argumentOf(directive, name);
  return value ? valueToString(value) === 'true' : null;
}

function valueToString(node: ValueNode): string {
  switch (node.kind) {
    case Kind.STRING:
    case Kind.INT:
    case Kind.FLOAT:
    case Kind.ENUM:
      return node.value;
    case Kind.BOOLEAN:
      return node.value ? 'true' : 'false';
    case Kind.NULL:
      return 'null';
    case Kind.LIST:
      return node.values.map(valueToString).join(', ');
    default:
      return '';
  }
}

function valueToList(node: ValueNode): string[] {
  const values = node.kind === Kind.LIST ? node.values : [node];
  return values.map(valueToString).filter(value => value !== '');
}

function isNoiseTypeName(
  name: string,
  rootTypeNames: ReadonlySet<string>
): boolean {
  return (
    rootTypeNames.has(name) ||
    name.startsWith(INTROSPECTION_PREFIX) ||
    FEDERATION_TYPE_NAMES.includes(name) ||
    RELAY_TYPE_NAMES.includes(name) ||
    RELAY_SUFFIXES.some(suffix => hasNoiseSuffix(name, suffix)) ||
    HASURA_SUFFIXES.some(suffix => hasNoiseSuffix(name, suffix))
  );
}

// Edge and Connection are plausible type names on their own; only the
// generated <Type><Suffix> spelling is noise.
function hasNoiseSuffix(name: string, suffix: string): boolean {
  return name.length > suffix.length && name.endsWith(suffix);
}

function describe(node: {
  description?: StringValueNode;
  loc?: Location;
}): string {
  if (node.description) {
    return normalizeText(node.description.value);
  }
  if (!node.loc) return '';

  // # comments are lexed but never reach the AST, so the token chain in front
  // of the node is the only place they survive.
  const comments: string[] = [];
  let line = node.loc.startToken.line - 1;
  let token = node.loc.startToken.prev;

  while (
    token &&
    token.kind === TokenKind.COMMENT &&
    token.line === line &&
    (!token.prev || token.prev.line < token.line)
  ) {
    comments.unshift(token.value ?? '');
    line -= 1;
    token = token.prev;
  }

  return normalizeText(comments.join(' '));
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * A GraphQL name cannot carry a dot and every directive argument must be named,
 * so the two Prisma-flavoured spellings are rejected outright. A document the
 * strict parse refused is retried with them rewritten, and dropped if it fails.
 */
function sanitizePrismaDirectives(sdl: string): string {
  let out = '';
  let index = 0;
  let changed = false;

  while (index < sdl.length) {
    const char = sdl[index];

    if (char === '#') {
      const end = endOfLine(sdl, index);
      out += sdl.slice(index, end);
      index = end;
      continue;
    }

    if (char === '"') {
      const end = endOfString(sdl, index);
      out += sdl.slice(index, end);
      index = end;
      continue;
    }

    if (char !== '@' || !NAME_START.test(sdl[index + 1] ?? '')) {
      out += char;
      index += 1;
      continue;
    }

    let end = endOfName(sdl, index + 1);
    let name = sdl.slice(index + 1, end);

    while (sdl[end] === '.' && NAME_START.test(sdl[end + 1] ?? '')) {
      const partEnd = endOfName(sdl, end + 1);
      name += `_${sdl.slice(end + 1, partEnd)}`;
      end = partEnd;
      changed = true;
    }

    out += `@${name}`;
    index = end;

    const parenthesis = skipTrivia(sdl, index);
    if (sdl[parenthesis] !== '(') continue;

    out += sdl.slice(index, parenthesis + 1);
    index = parenthesis + 1;

    for (let argIndex = 0; index < sdl.length; argIndex++) {
      const start = skipTrivia(sdl, index);
      out += sdl.slice(index, start);
      index = start;
      if (sdl[index] === ')' || index >= sdl.length) break;

      const colon = argumentNameEnd(sdl, index);
      if (colon === -1) {
        out += argIndex === 0 ? 'value: ' : `value${argIndex}: `;
        changed = true;
      } else {
        out += sdl.slice(index, colon + 1);
        index = colon + 1;
      }

      // index + 1 keeps a value the scanner cannot make sense of from
      // stalling the loop; the retry parse drops the result either way.
      const valueEnd = Math.max(
        endOfValue(sdl, skipTrivia(sdl, index)),
        index + 1
      );
      out += sdl.slice(index, valueEnd);
      index = valueEnd;
    }
  }

  return changed ? out : sdl;
}

function argumentNameEnd(sdl: string, from: number): number {
  if (!NAME_START.test(sdl[from] ?? '')) return -1;

  const colon = skipTrivia(sdl, endOfName(sdl, from));
  return sdl[colon] === ':' ? colon : -1;
}

function endOfName(sdl: string, from: number): number {
  let index = from;
  while (index < sdl.length && NAME_PART.test(sdl[index])) {
    index += 1;
  }
  return index;
}

function endOfLine(sdl: string, from: number): number {
  const end = sdl.indexOf('\n', from);
  return end === -1 ? sdl.length : end;
}

function endOfString(sdl: string, from: number): number {
  if (sdl.startsWith('"""', from)) {
    const end = sdl.indexOf('"""', from + 3);
    return end === -1 ? sdl.length : end + 3;
  }

  let index = from + 1;
  while (index < sdl.length) {
    const char = sdl[index];
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '\n') return index;
    if (char === '"') return index + 1;
    index += 1;
  }
  return index;
}

function endOfValue(sdl: string, from: number): number {
  const brackets: string[] = [];
  let index = from;

  while (index < sdl.length) {
    const char = sdl[index];

    if (char === '"') {
      index = endOfString(sdl, index);
      continue;
    }
    if (char === '[' || char === '{') {
      brackets.push(char);
      index += 1;
      continue;
    }
    if (char === ']' || char === '}') {
      if (!brackets.length) break;

      brackets.pop();
      index += 1;
      if (!brackets.length) return index;
      continue;
    }
    if (!brackets.length && (char === ')' || char === ',' || char === '#')) {
      break;
    }
    if (!brackets.length && /\s/.test(char)) break;

    index += 1;
  }

  return index;
}

function skipTrivia(sdl: string, from: number): number {
  let index = from;

  while (index < sdl.length) {
    const char = sdl[index];
    if (char === '#') {
      index = endOfLine(sdl, index);
      continue;
    }
    if (!/[\s,]/.test(char)) break;

    index += 1;
  }

  return index;
}

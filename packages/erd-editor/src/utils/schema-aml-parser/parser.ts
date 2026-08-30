import { Token, tokenize, TokenKind } from './tokenizer';
import {
  AMLAttribute,
  AMLCardinality,
  AMLEndpoint,
  AMLEntity,
  AMLModel,
  AMLNamespace,
  AMLParseResult,
  AMLRelation,
  AMLType,
  EMPTY_NAMESPACE,
} from './types';

type Line = {
  depth: number;
  tokens: Token[];
};

type Reader = {
  peek: (offset?: number) => Token | null;
  next: () => Token | null;
  atEnd: () => boolean;
};

type Skip = (label: string) => void;

type Extra = {
  autoIncrement: boolean;
  doc: string;
  comment: string;
};

type Segment = { name: string } | null;

type EntityRef = {
  namespace: AMLNamespace;
  name: string;
};

type RelationTail = {
  ref: AMLEndpoint;
  srcCardinality: AMLCardinality;
  refCardinality: AMLCardinality;
  polymorphic: boolean;
};

/** The running parent path advanceNesting rewrites, one entity at a time. */
type Nesting = {
  path: string[];
  depth: number;
};

// A keyword never reads as a name, which is why full.aml spells "index"
// quoted; indexed stays one identifier and so never reaches this set.
const KEYWORDS = new Set([
  'as',
  'check',
  'false',
  'fk',
  'index',
  'namespace',
  'null',
  'nullable',
  'pk',
  'rel',
  'true',
  'type',
  'unique',
]);
const VALUE_KEYWORDS = new Set(['false', 'null', 'true']);
const INTEGER = /^-?\d+$/;

export function parseAMLModel(source: string): AMLParseResult {
  try {
    return { ok: true, model: parseDocument(toLines(tokenize(source))) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Invalid AML',
    };
  }
}

/**
 * AML is one statement per line, so the token stream is cut on its newlines and
 * every rule below reads a single line to its end.
 */
function toLines(tokens: Token[]): Line[] {
  const lines: Line[] = [];
  let current: Line | null = null;

  tokens.forEach(token => {
    if (token.kind === TokenKind.newline) {
      current = { depth: token.depth, tokens: [] };
      lines.push(current);
      return;
    }

    current?.tokens.push(token);
  });

  return lines;
}

function createReader(tokens: Token[]): Reader {
  let index = 0;

  return {
    peek: (offset = 0) => tokens[index + offset] ?? null,
    next: () => tokens[index++] ?? null,
    atEnd: () => index >= tokens.length,
  };
}

function parseDocument(lines: Line[]): AMLModel {
  const model: AMLModel = {
    entities: [],
    relations: [],
    types: {},
    skipped: [],
  };
  const seen = new Set<string>();

  const skip: Skip = label => {
    if (label !== '' && !seen.has(label)) {
      seen.add(label);
      model.skipped.push(label);
    }
  };

  let namespace = EMPTY_NAMESPACE;
  let entity: AMLEntity | null = null;
  let nesting: Nesting = { path: [], depth: 0 };

  lines.forEach(line => {
    const reader = createReader(line.tokens);
    const token = reader.peek();
    if (!token) return;

    // An indented line is only ever an attribute of the entity above it.
    if (line.depth >= 0) {
      if (entity !== null) {
        parseAttribute(reader, line.depth, entity, nesting, model, skip);
      }
      return;
    }

    const keyword =
      token.kind === TokenKind.identifier ? token.value.toLowerCase() : '';

    if (keyword === 'namespace') {
      reader.next();
      namespace = readNamespace(reader);
      return;
    }

    if (keyword === 'rel' || keyword === 'fk') {
      reader.next();
      const relation = parseRelation(reader, namespace, skip);
      if (relation) {
        model.relations.push(relation);
      }
      return;
    }

    if (keyword === 'type') {
      reader.next();
      parseType(reader, namespace, model, skip);
      return;
    }

    if (!isName(token)) return;

    const parsed = parseEntity(reader, namespace, skip);
    if (parsed) {
      model.entities.push(parsed);
      entity = parsed;
      nesting = { path: [], depth: 0 };
    }
  });

  return model;
}

function parseEntity(
  reader: Reader,
  namespace: AMLNamespace,
  skip: Skip
): AMLEntity | null {
  const ref = readEntityRef(reader);
  if (ref.name === '') {
    return null;
  }

  const asterisk = reader.peek();
  if (asterisk && isPunctuation(asterisk, '*')) {
    reader.next();
    skip('view');
  }

  const alias = readAlias(reader);
  const extra = readExtra(reader, skip);

  return {
    namespace: mergeNamespace(namespace, ref.namespace),
    name: ref.name,
    alias,
    comment: extra.doc || extra.comment,
    attributes: [],
  };
}

function parseAttribute(
  reader: Reader,
  depth: number,
  entity: AMLEntity,
  nesting: Nesting,
  model: AMLModel,
  skip: Skip
) {
  const name = readName(reader);
  if (name === '') return;

  const type = readAttributeType(reader);
  const attribute: AMLAttribute = {
    path: advanceNesting(nesting, depth, name),
    comment: '',
    typeName: type.typeName,
    enumValues: type.enumValues,
    notNull: true,
    primaryKey: false,
    indexes: [],
    default: type.default,
    autoIncrement: false,
  };

  const nullable = reader.peek();
  if (nullable && isKeyword(nullable, 'nullable')) {
    reader.next();
    attribute.notNull = false;
  }

  readConstraints(reader, attribute, entity, model, skip);

  const extra = readExtra(reader, skip);
  attribute.comment = extra.doc || extra.comment;
  attribute.autoIncrement = extra.autoIncrement;

  entity.attributes.push(attribute);
}

/**
 * Reproduces the reference's nestAttributes: the parent path only ever grows
 * one level at a time, so an over-indented line lands under the attribute above
 * it instead of dropping.
 */
function advanceNesting(nesting: Nesting, depth: number, name: string): string {
  if (depth === 0 || nesting.path.length === 0) {
    nesting.depth = 0;
    nesting.path = [name];
  } else if (depth > nesting.depth) {
    nesting.depth += 1;
    nesting.path = [...nesting.path, name];
  } else {
    const up = nesting.depth - depth;
    nesting.depth = depth;
    nesting.path = [...nesting.path.slice(0, -(up + 1)), name];
  }

  return nesting.path.join('.');
}

function readAttributeType(reader: Reader): {
  typeName: string;
  enumValues: string[];
  default: string;
} {
  const name = readName(reader);
  if (name === '') {
    return { typeName: '', enumValues: [], default: '' };
  }

  let typeName = name;
  let enumValues: string[] = [];
  const opening = reader.peek();

  if (opening && isPunctuation(opening, '(')) {
    reader.next();
    const { values, numeric } = readValueList(reader);
    // Up to two integers are the type's own parameters -- varchar(100),
    // decimal(2,3) -- and anything else is an inline enum.
    if (values.length !== 0 && values.length <= 2 && numeric) {
      typeName = `${name}(${values.join(',')})`;
    } else {
      enumValues = values;
    }
  }

  const equal = reader.peek();
  if (equal && isPunctuation(equal, '=')) {
    reader.next();
    return { typeName, enumValues, default: readValue(reader) };
  }

  return { typeName, enumValues, default: '' };
}

function readConstraints(
  reader: Reader,
  attribute: AMLAttribute,
  entity: AMLEntity,
  model: AMLModel,
  skip: Skip
) {
  const pushRelation = () => {
    const tail = readRelationTail(reader);
    if (!tail) return false;

    model.relations.push({
      src: {
        namespace: entity.namespace,
        entityName: entity.name,
        attributePaths: [attribute.path],
      },
      ...tail,
    });

    return true;
  };

  while (!reader.atEnd()) {
    const token = reader.peek();
    if (!token) return;

    if (token.kind === TokenKind.identifier) {
      const keyword = token.value.toLowerCase();

      if (keyword === 'pk') {
        reader.next();
        readConstraintName(reader);
        attribute.primaryKey = true;
        continue;
      }

      if (keyword === 'unique' || keyword === 'index') {
        reader.next();
        attribute.indexes.push({
          name: readConstraintName(reader),
          unique: keyword === 'unique',
        });
        continue;
      }

      if (keyword === 'check') {
        reader.next();
        readCheck(reader);
        skip('check');
        continue;
      }

      if (keyword === 'fk' && pushRelation()) {
        continue;
      }

      return;
    }

    if (isCardinality(token) && pushRelation()) {
      continue;
    }

    return;
  }
}

function readCheck(reader: Reader) {
  const opening = reader.peek();
  if (opening && isPunctuation(opening, '(')) {
    reader.next();
    skipBalanced(reader, '(', ')');
  }

  readConstraintName(reader);
}

function readConstraintName(reader: Reader): string {
  const equal = reader.peek();
  if (!equal || !isPunctuation(equal, '=')) {
    return '';
  }
  reader.next();

  return readName(reader);
}

function parseRelation(
  reader: Reader,
  namespace: AMLNamespace,
  skip: Skip
): AMLRelation | null {
  const src = readAttributeRef(reader);
  const tail = readRelationTail(reader);
  readExtra(reader, skip);

  if (!tail || src.entityName === '') {
    return null;
  }

  return {
    src: isEmptyNamespace(src.namespace) ? { ...src, namespace } : src,
    ...tail,
  };
}

/**
 * The arrow reads its cardinalities in source order, so the first character is
 * the ref side and the second the src side: -> is one parent, many children.
 */
function readRelationTail(reader: Reader): RelationTail | null {
  const legacy = reader.peek();
  if (legacy && isKeyword(legacy, 'fk')) {
    reader.next();
    const ref = readAttributeRef(reader);

    return ref.entityName === ''
      ? null
      : { ref, srcCardinality: 'n', refCardinality: '1', polymorphic: false };
  }

  const refCardinality = readCardinality(reader);
  if (refCardinality === null) {
    return null;
  }

  const polymorphic = isPolymorphic(reader);
  if (polymorphic) {
    readAttributePath(reader);
    reader.next();
    readValue(reader);
  }

  const srcCardinality = readCardinality(reader) ?? 'n';
  const ref = readAttributeRef(reader);

  return ref.entityName === ''
    ? null
    : { ref, srcCardinality, refCardinality, polymorphic };
}

function readCardinality(reader: Reader): AMLCardinality | null {
  const token = reader.peek();
  if (!token || !isCardinality(token)) {
    return null;
  }
  reader.next();

  return token.value === '-' ? '1' : 'n';
}

/** -item_kind=User> -- an attribute path followed by = opens the discriminator. */
function isPolymorphic(reader: Reader): boolean {
  let offset = 0;

  for (;;) {
    const token = reader.peek(offset);
    if (!token || !isName(token)) {
      return false;
    }
    offset += 1;

    const dot = reader.peek(offset);
    if (!dot || !isPunctuation(dot, '.')) {
      break;
    }
    offset += 1;
  }

  const equal = reader.peek(offset);

  return equal !== null && isPunctuation(equal, '=');
}

function readAttributeRef(reader: Reader): AMLEndpoint {
  const ref = readEntityRef(reader);
  const opening = reader.peek();

  if (opening && isPunctuation(opening, '(')) {
    reader.next();

    return {
      namespace: ref.namespace,
      entityName: ref.name,
      attributePaths: readAttributePaths(reader),
    };
  }

  // A ref that names no attribute is natural: it binds to the target's primary
  // key, which only convert.ts can resolve.
  if (ref.namespace.schema === '') {
    return {
      namespace: EMPTY_NAMESPACE,
      entityName: ref.name,
      attributePaths: [],
    };
  }

  // AMLv1 spells the attribute as a trailing .column and nests it with :,
  // so one segment shifts out of the namespace and into the entity name.
  const path = [ref.name, ...readLegacyPath(reader)].join('.');

  return {
    namespace: { database: '', catalog: '', schema: ref.namespace.catalog },
    entityName: ref.namespace.schema,
    attributePaths: [path],
  };
}

function readAttributePaths(reader: Reader): string[] {
  const paths: string[] = [];

  while (!reader.atEnd()) {
    const token = reader.peek();
    if (!token || isPunctuation(token, ')')) {
      reader.next();
      break;
    }

    if (isName(token)) {
      paths.push(readAttributePath(reader));
      continue;
    }

    reader.next();
  }

  return paths;
}

function readAttributePath(reader: Reader): string {
  const path = [readName(reader)];

  while (!reader.atEnd()) {
    const dot = reader.peek();
    if (!dot || !isPunctuation(dot, '.')) break;
    reader.next();

    const name = readName(reader);
    if (name === '') break;

    path.push(name);
  }

  return path.join('.');
}

function readLegacyPath(reader: Reader): string[] {
  const path: string[] = [];

  while (!reader.atEnd()) {
    const colon = reader.peek();
    if (!colon || !isPunctuation(colon, ':')) break;
    reader.next();

    const name = readName(reader);
    if (name === '') break;

    path.push(name);
  }

  return path;
}

function parseType(
  reader: Reader,
  namespace: AMLNamespace,
  model: AMLModel,
  skip: Skip
) {
  const ref = readEntityRef(reader);
  if (ref.name === '') return;

  const type: AMLType = { values: [], alias: '' };
  const token = reader.peek();

  if (token && isPunctuation(token, '(')) {
    reader.next();
    type.values = readValueList(reader).values;
  } else if (token && isPunctuation(token, '{')) {
    reader.next();
    skipBalanced(reader, '{', '}');
    skip('struct type');
  } else if (token && token.kind === TokenKind.expression) {
    reader.next();
    skip('custom type');
  } else if (token && isName(token)) {
    type.alias = readName(reader);
  }

  readExtra(reader, skip);

  const merged = mergeNamespace(namespace, ref.namespace);
  const qualified = [merged.database, merged.catalog, merged.schema, ref.name]
    .filter(part => part !== '')
    .join('.');

  model.types[qualified] = type;
  if (qualified !== ref.name && !(ref.name in model.types)) {
    model.types[ref.name] = type;
  }
}

function readNamespace(reader: Reader): AMLNamespace {
  const first = readName(reader);
  if (first === '') {
    return EMPTY_NAMESPACE;
  }

  const second = readSegment(reader);
  const third = readSegment(reader);

  if (second && third) {
    return { database: first, catalog: second.name, schema: third.name };
  }
  if (second) {
    return { database: '', catalog: first, schema: second.name };
  }

  return { database: '', catalog: '', schema: first };
}

/**
 * Right-associative over four segments, and a dot with nothing after it still
 * counts -- that is what makes identity...profiles and social. legal.
 */
function readEntityRef(reader: Reader): EntityRef {
  const first = readName(reader);
  if (first === '') {
    return { namespace: EMPTY_NAMESPACE, name: '' };
  }

  const second = readSegment(reader);
  const third = readSegment(reader);
  const fourth = readSegment(reader);

  if (second && third && fourth && fourth.name !== '') {
    return {
      namespace: {
        database: first,
        catalog: second.name,
        schema: third.name,
      },
      name: fourth.name,
    };
  }
  if (second && third && third.name !== '') {
    return {
      namespace: { database: '', catalog: first, schema: second.name },
      name: third.name,
    };
  }
  if (second && second.name !== '') {
    return {
      namespace: { database: '', catalog: '', schema: first },
      name: second.name,
    };
  }

  return { namespace: EMPTY_NAMESPACE, name: first };
}

function readSegment(reader: Reader): Segment {
  const dot = reader.peek();
  if (!dot || !isPunctuation(dot, '.')) {
    return null;
  }
  reader.next();

  return { name: readName(reader) };
}

function readAlias(reader: Reader): string {
  const token = reader.peek();
  if (!token || !isKeyword(token, 'as')) {
    return '';
  }
  reader.next();

  return readName(reader);
}

/**
 * The {props} / | doc / # comment tail. It runs to the end of the line, so
 * anything a rule above could not read degrades to nothing rather than throwing.
 */
function readExtra(reader: Reader, skip: Skip): Extra {
  const extra: Extra = { autoIncrement: false, doc: '', comment: '' };

  while (!reader.atEnd()) {
    const token = reader.next();
    if (!token) break;

    if (isPunctuation(token, '{')) {
      readProperties(reader, extra, skip);
      continue;
    }
    if (token.kind === TokenKind.doc && extra.doc === '') {
      extra.doc = token.value;
      continue;
    }
    if (token.kind === TokenKind.comment && extra.comment === '') {
      extra.comment = token.value;
    }
  }

  return extra;
}

function readProperties(reader: Reader, extra: Extra, skip: Skip) {
  while (!reader.atEnd()) {
    const token = reader.next();
    if (!token || isPunctuation(token, '}')) return;

    if (
      token.kind !== TokenKind.identifier &&
      token.kind !== TokenKind.quoted
    ) {
      continue;
    }

    const separator = reader.peek();
    if (
      separator &&
      (isPunctuation(separator, ':') || isPunctuation(separator, '='))
    ) {
      reader.next();
      skipPropertyValue(reader);
    }

    if (token.value.toLowerCase() === 'autoincrement') {
      extra.autoIncrement = true;
    } else {
      skip(token.value);
    }
  }
}

function skipPropertyValue(reader: Reader) {
  let depth = 0;

  while (!reader.atEnd()) {
    const token = reader.peek();
    if (!token) return;
    if (
      depth === 0 &&
      (isPunctuation(token, ',') || isPunctuation(token, '}'))
    ) {
      return;
    }
    reader.next();

    if (isPunctuation(token, '[')) {
      depth += 1;
    } else if (isPunctuation(token, ']')) {
      depth -= 1;
    }
  }
}

function readValueList(reader: Reader): {
  values: string[];
  numeric: boolean;
} {
  const values: string[] = [];
  let numeric = true;

  while (!reader.atEnd()) {
    const token = reader.peek();
    if (!token || isPunctuation(token, ')')) {
      reader.next();
      break;
    }

    if (isPunctuation(token, ',')) {
      reader.next();
      continue;
    }

    const value = readValue(reader);
    values.push(value);
    numeric = numeric && token.kind !== TokenKind.quoted && INTEGER.test(value);
  }

  return { values, numeric };
}

function readValue(reader: Reader): string {
  const token = reader.peek();
  if (!token) return '';

  if (isPunctuation(token, '-') && reader.peek(1)?.kind === TokenKind.number) {
    reader.next();

    return `-${reader.next()?.value ?? ''}`;
  }
  reader.next();

  switch (token.kind) {
    case TokenKind.expression:
      return `\`${token.value}\``;
    case TokenKind.string:
      return `'${token.value}'`;
    case TokenKind.identifier:
      return VALUE_KEYWORDS.has(token.value.toLowerCase())
        ? token.value.toLowerCase()
        : token.value;
    default:
      return token.value;
  }
}

function readName(reader: Reader): string {
  const token = reader.peek();
  if (!token || !isName(token)) {
    return '';
  }
  reader.next();

  return token.value;
}

function mergeNamespace(
  defaults: AMLNamespace,
  ref: AMLNamespace
): AMLNamespace {
  return {
    database: ref.database || defaults.database,
    catalog: ref.catalog || defaults.catalog,
    schema: ref.schema || defaults.schema,
  };
}

function isEmptyNamespace(namespace: AMLNamespace): boolean {
  return (
    namespace.database === '' &&
    namespace.catalog === '' &&
    namespace.schema === ''
  );
}

function skipBalanced(reader: Reader, opening: string, closing: string) {
  let depth = 1;

  while (!reader.atEnd() && depth !== 0) {
    const token = reader.next();
    if (!token) break;

    if (isPunctuation(token, opening)) {
      depth += 1;
    } else if (isPunctuation(token, closing)) {
      depth -= 1;
    }
  }
}

function isName(token: Token): boolean {
  return (
    token.kind === TokenKind.quoted ||
    (token.kind === TokenKind.identifier &&
      !KEYWORDS.has(token.value.toLowerCase()))
  );
}

function isKeyword(token: Token, value: string): boolean {
  return (
    token.kind === TokenKind.identifier && token.value.toLowerCase() === value
  );
}

function isCardinality(token: Token): boolean {
  return (
    token.kind === TokenKind.punctuation &&
    (token.value === '-' || token.value === '<' || token.value === '>')
  );
}

function isPunctuation(token: Token, value: string): boolean {
  return token.kind === TokenKind.punctuation && token.value === value;
}

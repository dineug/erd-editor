import { Token, tokenize, TokenKind } from './tokenizer';
import {
  DBMLColumn,
  DBMLEndpoint,
  DBMLIndex,
  DBMLInlineRef,
  DBMLModel,
  DBMLParseResult,
  DBMLRef,
  DBMLTable,
} from './types';

type Setting = {
  key: string;
  tokens: Token[];
};

type Reader = {
  peek: (offset?: number) => Token | null;
  next: () => Token | null;
  atEnd: () => boolean;
};

const SETTING_KEY = /^[0-9a-z ]+$/;
const QUOTE = /'/g;
const QUESTION = /\?/g;

export function parseDBMLModel(source: string): DBMLParseResult {
  try {
    return { ok: true, model: parseDocument(tokenize(source)) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Invalid DBML',
    };
  }
}

function createReader(tokens: Token[]): Reader {
  let index = 0;

  return {
    peek: (offset = 0) => tokens[index + offset] ?? null,
    next: () => tokens[index++] ?? null,
    atEnd: () => index >= tokens.length,
  };
}

function parseDocument(tokens: Token[]): DBMLModel {
  const reader = createReader(tokens);
  const model: DBMLModel = { tables: [], refs: [], enums: {}, skipped: [] };
  const partials = new Map<string, DBMLColumn[]>();
  const skipped = new Set<string>();

  const skip = (kind: string) => {
    if (!skipped.has(kind)) {
      skipped.add(kind);
      model.skipped.push(kind);
    }
    skipElement(reader);
  };

  while (!reader.atEnd()) {
    if (skipNewlines(reader)) {
      continue;
    }

    const token = reader.peek();
    if (!token) break;

    if (!isName(token)) {
      reader.next();
      continue;
    }

    const keyword = token.value.toLowerCase();

    if (keyword === 'table' && token.kind === TokenKind.identifier) {
      reader.next();
      const table = parseTable(reader, partials);
      if (table) {
        model.tables.push(table);
      }
      continue;
    }

    if (keyword === 'tablepartial' && token.kind === TokenKind.identifier) {
      reader.next();
      const partial = parseTable(reader, partials);
      if (partial) {
        partials.set(partial.name, partial.columns);
      }
      continue;
    }

    if (keyword === 'ref' && token.kind === TokenKind.identifier) {
      reader.next();
      model.refs.push(...parseRef(reader));
      continue;
    }

    if (keyword === 'enum' && token.kind === TokenKind.identifier) {
      reader.next();
      parseEnum(reader, model.enums);
      continue;
    }

    skip(keyword);
  }

  return model;
}

function parseTable(
  reader: Reader,
  partials: Map<string, DBMLColumn[]>
): DBMLTable | null {
  const { schemaName, name } = readQualifiedName(reader);
  const table: DBMLTable = {
    schemaName,
    name,
    alias: '',
    comment: '',
    columns: [],
    indexes: [],
  };

  const alias = reader.peek();
  if (
    alias &&
    alias.kind === TokenKind.identifier &&
    alias.value.toLowerCase() === 'as'
  ) {
    reader.next();
    table.alias = readName(reader);
  }

  applyNoteSetting(table, readSettings(reader));

  if (!consumeBrace(reader)) {
    return name === '' ? null : table;
  }

  while (!reader.atEnd()) {
    if (skipNewlines(reader)) {
      continue;
    }

    const token = reader.peek();
    if (!token) break;

    if (token.kind === TokenKind.punctuation && token.value === '}') {
      reader.next();
      break;
    }

    if (token.kind === TokenKind.punctuation && token.value === '~') {
      reader.next();
      const injected = partials.get(readName(reader));
      if (injected) {
        table.columns.push(...injected.map(column => ({ ...column })));
      }
      continue;
    }

    if (token.kind === TokenKind.identifier) {
      const keyword = token.value.toLowerCase();
      const following = reader.peek(1);

      if (keyword === 'note' && following && isPunctuation(following, ':')) {
        reader.next();
        reader.next();
        table.comment = readTextValue(reader);
        continue;
      }

      if (keyword === 'note' && following && isPunctuation(following, '{')) {
        reader.next();
        reader.next();
        table.comment = readBlockText(reader);
        continue;
      }

      if (keyword === 'indexes' && following && isPunctuation(following, '{')) {
        reader.next();
        reader.next();
        table.indexes.push(...parseIndexes(reader));
        continue;
      }

      if (following && isPunctuation(following, '{')) {
        reader.next();
        reader.next();
        skipBlock(reader);
        continue;
      }
    }

    const column = parseColumn(reader);
    if (column) {
      table.columns.push(column);
    }
  }

  return table;
}

function parseColumn(reader: Reader): DBMLColumn | null {
  const nameToken = reader.peek();
  if (!nameToken || !isName(nameToken)) {
    skipLine(reader);
    return null;
  }
  reader.next();

  const column: DBMLColumn = {
    name: nameToken.value,
    comment: '',
    typeName: '',
    typeSchemaName: '',
    primaryKey: false,
    unique: false,
    notNull: false,
    autoIncrement: false,
    default: '',
    inlineRefs: [],
  };

  const type = readColumnType(reader);
  column.typeName = type.name;
  column.typeSchemaName = type.schemaName;

  applyColumnSettings(column, readSettings(reader));
  skipLine(reader);

  return column.typeName === '' ? null : column;
}

function readColumnType(reader: Reader): {
  name: string;
  schemaName: string;
} {
  const { schemaName, name } = readQualifiedName(reader);
  if (name === '') {
    return { name: '', schemaName: '' };
  }

  const parts = [name];
  const open = reader.peek();

  if (open && isPunctuation(open, '(')) {
    reader.next();
    parts.push(`(${readArguments(reader)})`);
  }

  const bracket = reader.peek();
  const closing = reader.peek(1);

  if (
    bracket &&
    closing &&
    isPunctuation(bracket, '[') &&
    isPunctuation(closing, ']')
  ) {
    reader.next();
    reader.next();
    parts.push('[]');
  }

  return { name: parts.join(''), schemaName };
}

function readArguments(reader: Reader): string {
  const parts: string[] = [];

  while (!reader.atEnd()) {
    const token = reader.next();
    if (!token || isPunctuation(token, ')')) {
      break;
    }
    if (token.kind === TokenKind.newline) {
      continue;
    }
    parts.push(
      token.kind === TokenKind.string ? `'${token.value}'` : token.value
    );
  }

  return parts.join('');
}

function parseIndexes(reader: Reader): DBMLIndex[] {
  const indexes: DBMLIndex[] = [];

  while (!reader.atEnd()) {
    if (skipNewlines(reader)) {
      continue;
    }

    const token = reader.peek();
    if (!token) break;

    if (isPunctuation(token, '}')) {
      reader.next();
      break;
    }

    const index: DBMLIndex = {
      name: '',
      unique: false,
      primaryKey: false,
      columnNames: [],
    };

    if (isPunctuation(token, '(')) {
      reader.next();
      index.columnNames.push(...readIndexColumns(reader));
    } else if (isName(token)) {
      reader.next();
      index.columnNames.push(token.value);
    } else {
      // An expression column names no column, so there is nothing to bind.
      reader.next();
    }

    applyIndexSettings(index, readSettings(reader));
    skipLine(reader);

    if (index.columnNames.length !== 0) {
      indexes.push(index);
    }
  }

  return indexes;
}

function readIndexColumns(reader: Reader): string[] {
  const names: string[] = [];

  while (!reader.atEnd()) {
    const token = reader.next();
    if (!token || isPunctuation(token, ')')) {
      break;
    }
    if (isName(token)) {
      names.push(token.value);
    }
  }

  return names;
}

function parseRef(reader: Reader): DBMLRef[] {
  const named = reader.peek();
  if (named && isName(named)) {
    const following = reader.peek(1);
    if (
      following &&
      (isPunctuation(following, ':') || isPunctuation(following, '{'))
    ) {
      reader.next();
    }
  }

  const opening = reader.peek();

  if (opening && isPunctuation(opening, ':')) {
    reader.next();
    const ref = readRefBody(reader);
    skipLine(reader);
    return ref ? [ref] : [];
  }

  if (!consumeBrace(reader)) {
    skipLine(reader);
    return [];
  }

  const refs: DBMLRef[] = [];

  while (!reader.atEnd()) {
    if (skipNewlines(reader)) {
      continue;
    }

    const token = reader.peek();
    if (!token) break;

    if (isPunctuation(token, '}')) {
      reader.next();
      break;
    }

    const ref = readRefBody(reader);
    if (ref) {
      refs.push(ref);
    } else {
      skipLine(reader);
    }
  }

  return refs;
}

function readRefBody(reader: Reader): DBMLRef | null {
  const left = readEndpoint(reader);
  const operator = readOperator(reader);
  if (operator === '') {
    return null;
  }

  const right = readEndpoint(reader);
  readSettings(reader);

  return left.tableName === '' || right.tableName === ''
    ? null
    : { operator, left, right };
}

function readOperator(reader: Reader): string {
  const token = reader.peek();
  if (!token) return '';

  if (token.kind === TokenKind.operator) {
    reader.next();
    return token.value.replace(QUESTION, '');
  }

  if (isPunctuation(token, '-')) {
    reader.next();
    return '-';
  }

  return '';
}

function readEndpoint(reader: Reader): DBMLEndpoint {
  const names: string[] = [];
  const columnNames: string[] = [];

  while (!reader.atEnd()) {
    const token = reader.peek();
    if (!token || !isName(token)) break;

    reader.next();
    names.push(token.value);

    const dot = reader.peek();
    if (!dot || !isPunctuation(dot, '.')) break;
    reader.next();

    const tuple = reader.peek();
    if (tuple && isPunctuation(tuple, '(')) {
      reader.next();
      columnNames.push(...readIndexColumns(reader));
      break;
    }
  }

  if (columnNames.length === 0 && names.length !== 0) {
    columnNames.push(names.pop() as string);
  }

  const tableName = names.pop() ?? '';
  const schemaName = names.pop() ?? '';

  return { schemaName, tableName, columnNames };
}

function parseEnum(reader: Reader, enums: Record<string, string[]>) {
  const { schemaName, name } = readQualifiedName(reader);
  readSettings(reader);

  if (!consumeBrace(reader)) {
    skipLine(reader);
    return;
  }

  const members: string[] = [];

  while (!reader.atEnd()) {
    if (skipNewlines(reader)) {
      continue;
    }

    const token = reader.peek();
    if (!token) break;

    if (isPunctuation(token, '}')) {
      reader.next();
      break;
    }

    if (isName(token)) {
      reader.next();
      members.push(token.value);
      readSettings(reader);
    } else {
      reader.next();
    }

    skipLine(reader);
  }

  if (name === '') return;

  enums[schemaName ? `${schemaName}.${name}` : name] = members;
  if (schemaName && !(name in enums)) {
    enums[name] = members;
  }
}

function readSettings(reader: Reader): Setting[] {
  const opening = reader.peek();
  if (!opening || !isPunctuation(opening, '[')) {
    return [];
  }
  reader.next();

  const settings: Setting[] = [];
  let keyParts: string[] = [];
  let tokens: Token[] = [];
  let separated = false;

  const flush = () => {
    const key = keyParts.join(' ').toLowerCase();
    if (key !== '' || tokens.length !== 0) {
      settings.push({ key, tokens });
    }
    keyParts = [];
    tokens = [];
    separated = false;
  };

  while (!reader.atEnd()) {
    const token = reader.next();
    if (!token) break;

    if (isPunctuation(token, ']')) {
      break;
    }

    if (isPunctuation(token, ',')) {
      flush();
      continue;
    }

    if (!separated && isPunctuation(token, ':')) {
      separated = true;
      continue;
    }

    if (separated) {
      tokens.push(token);
      continue;
    }

    if (isName(token) && SETTING_KEY.test(token.value.toLowerCase())) {
      keyParts.push(token.value);
      continue;
    }

    separated = true;
    tokens.push(token);
  }

  flush();

  return settings;
}

function applyColumnSettings(column: DBMLColumn, settings: Setting[]) {
  settings.forEach(({ key, tokens }) => {
    switch (key) {
      case 'pk':
      case 'primary key':
        column.primaryKey = true;
        break;
      case 'unique':
        column.unique = true;
        break;
      case 'not null':
        column.notNull = true;
        break;
      case 'increment':
        column.autoIncrement = true;
        break;
      case 'note':
        column.comment = textOf(tokens);
        break;
      case 'default':
        column.default = defaultOf(tokens);
        break;
      case 'ref': {
        const inlineRef = inlineRefOf(tokens);
        if (inlineRef) {
          column.inlineRefs.push(inlineRef);
        }
        break;
      }
    }
  });
}

function applyIndexSettings(index: DBMLIndex, settings: Setting[]) {
  settings.forEach(({ key, tokens }) => {
    switch (key) {
      case 'name':
        index.name = textOf(tokens);
        break;
      case 'unique':
        index.unique = true;
        break;
      case 'pk':
      case 'primary key':
        index.primaryKey = true;
        break;
    }
  });
}

function applyNoteSetting(table: DBMLTable, settings: Setting[]) {
  settings.forEach(({ key, tokens }) => {
    if (key === 'note') {
      table.comment = textOf(tokens);
    }
  });
}

function inlineRefOf(tokens: Token[]): DBMLInlineRef | null {
  const reader = createReader(tokens);
  const operator = readOperator(reader);
  if (operator === '') {
    return null;
  }

  const target = readEndpoint(reader);

  return target.tableName === '' ? null : { operator, target };
}

function textOf(tokens: Token[]): string {
  const token = tokens.find(
    candidate =>
      candidate.kind === TokenKind.string ||
      candidate.kind === TokenKind.quoted ||
      candidate.kind === TokenKind.identifier
  );

  return token ? token.value : '';
}

function defaultOf(tokens: Token[]): string {
  const values = tokens.filter(token => token.kind !== TokenKind.newline);
  const first = values[0];
  if (!first) return '';

  if (isPunctuation(first, '-') && values[1]?.kind === TokenKind.number) {
    return `-${values[1].value}`;
  }

  switch (first.kind) {
    case TokenKind.string:
      return `'${first.value.replace(QUOTE, "''")}'`;
    case TokenKind.expression:
    case TokenKind.number:
    case TokenKind.identifier:
    case TokenKind.quoted:
      return first.value;
    default:
      return values.map(token => token.value).join('');
  }
}

function readQualifiedName(reader: Reader): {
  schemaName: string;
  name: string;
} {
  const first = readName(reader);
  if (first === '') {
    return { schemaName: '', name: '' };
  }

  const dot = reader.peek();
  if (!dot || !isPunctuation(dot, '.')) {
    return { schemaName: '', name: first };
  }
  reader.next();

  return { schemaName: first, name: readName(reader) };
}

function readName(reader: Reader): string {
  const token = reader.peek();
  if (!token || !isName(token)) {
    return '';
  }
  reader.next();

  return token.value;
}

function readTextValue(reader: Reader): string {
  const token = reader.peek();
  if (
    token &&
    (token.kind === TokenKind.string || token.kind === TokenKind.quoted)
  ) {
    reader.next();
    return token.value;
  }

  return '';
}

function readBlockText(reader: Reader): string {
  let text = '';

  while (!reader.atEnd()) {
    const token = reader.next();
    if (!token || isPunctuation(token, '}')) {
      break;
    }
    if (text === '' && token.kind === TokenKind.string) {
      text = token.value;
    }
  }

  return text;
}

function consumeBrace(reader: Reader): boolean {
  let offset = 0;

  while (reader.peek(offset)?.kind === TokenKind.newline) {
    offset += 1;
  }

  const token = reader.peek(offset);
  if (!token || !isPunctuation(token, '{')) {
    return false;
  }

  for (let step = 0; step <= offset; step += 1) {
    reader.next();
  }

  return true;
}

function skipBlock(reader: Reader) {
  let depth = 1;

  while (!reader.atEnd() && depth !== 0) {
    const token = reader.next();
    if (!token) break;

    if (isPunctuation(token, '{')) {
      depth += 1;
    } else if (isPunctuation(token, '}')) {
      depth -= 1;
    }
  }
}

function skipElement(reader: Reader) {
  if (consumeBrace(reader)) {
    skipBlock(reader);
    return;
  }

  while (!reader.atEnd()) {
    const token = reader.next();
    if (!token || token.kind === TokenKind.newline) {
      return;
    }
    if (isPunctuation(token, '{')) {
      skipBlock(reader);
      return;
    }
  }
}

function skipLine(reader: Reader) {
  while (!reader.atEnd()) {
    const token = reader.peek();
    if (!token) return;
    if (token.kind === TokenKind.newline) {
      reader.next();
      return;
    }
    if (isPunctuation(token, '}')) {
      return;
    }
    reader.next();
  }
}

function skipNewlines(reader: Reader): boolean {
  const token = reader.peek();
  if (token && token.kind === TokenKind.newline) {
    reader.next();
    return true;
  }

  return false;
}

function isName(token: Token): boolean {
  return token.kind === TokenKind.identifier || token.kind === TokenKind.quoted;
}

function isPunctuation(token: Token, value: string): boolean {
  return token.kind === TokenKind.punctuation && token.value === value;
}

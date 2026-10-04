import { query } from '@dineug/erd-editor-schema';

import {
  ColumnOption,
  ColumnUIKey,
  RelationshipType,
  StartRelationshipType,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column, Relationship, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { orderByNameASC } from '@/utils/schema-sql/utils';
import { getUniqueIndexKeys } from '@/utils/tableKeys';

import { FormatTableOptions } from './utils';

/**
 * An attribute word as the erDiagram lexer of mermaid 11.17.2, the release
 * GitHub renders, reads one, its flags included: no u flag, so a character
 * past the BMP passes as its two surrogates.
 */
const ATTRIBUTE_WORD =
  /^[*A-Za-z_\u00c0-\uffff][A-Za-z0-9\-_[\]().,\u00c0-\uffff*]*$/i;
/** The lexer tries its key rule first, so pk-id would start with a key too. */
const ATTRIBUTE_KEY = /^(PK|FK|UK)\b/i;
/** What a quoted entity name cannot hold; in a class, \b is the backspace. */
const ENTITY_NAME_EXCLUDED = /["%\r\n\v\b\\]/g;
const BACKTICK = /`/g;
const DOUBLE_QUOTE = /"/g;
const LINE_TERMINATOR = /\r\n|[\n\r]/g;
/**
 * The generic type rule of that release, which its lexer tries ahead of a
 * backtick and a comment: a word holding a tilde, up to the line's last tilde.
 */
const GENERIC_TYPE_RUN = /^\S*~.*~/;
const TILDE = /~/g;
/** U+FF5E, which no rule of that lexer reads as a tilde. */
const FULLWIDTH_TILDE = '\uff5e';
const UNNAMED = 'unnamed';
const UNKNOWN_TYPE = 'unknown';

// 1, 32 and 64 are the RelationshipType members left commented out in
// @dineug/erd-editor-schema; they have no constant, so the bits are spelled out.
const CHILD_CARDINALITY: Record<number, string> = {
  [1]: 'o{',
  [RelationshipType.ZeroOne]: 'o|',
  [RelationshipType.ZeroN]: 'o{',
  [RelationshipType.OneOnly]: '||',
  [RelationshipType.OneN]: '|{',
  [32]: '||',
  [64]: '|{',
};

export function createCode(state: RootState): string {
  const tables = selectTables(state);

  if (tables.length === 0) {
    return '';
  }

  const entityNames = createEntityNames(tables);
  const buffer: string[] = ['', 'erDiagram'];

  tables.forEach(table => {
    formatEntity(state, buffer, table, entityNames.get(table.id) as string);
    buffer.push('');
  });

  const relationships = formatRelationships(state, entityNames);

  if (relationships.length !== 0) {
    relationships.forEach(line => buffer.push(line));
    buffer.push('');
  }

  return buffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table }: FormatTableOptions
) {
  const name =
    createEntityNames(selectTables(state)).get(table.id) ??
    toEntityName(table.name);

  buffer.push('erDiagram');
  formatEntity(state, buffer, table, name);
}

function selectTables({ doc: { tableIds }, collections }: RootState): Table[] {
  return query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC);
}

function createEntityNames(tables: Table[]): Map<string, string> {
  const used = new Set<string>();

  return new Map(
    tables.map(table => [table.id, uniqueName(used, toEntityName(table.name))])
  );
}

function formatEntity(
  state: RootState,
  buffer: string[],
  table: Table,
  name: string
) {
  if (table.comment.trim() !== '') {
    buffer.push(`  %% ${table.comment.replace(LINE_TERMINATOR, ' ')}`);
  }

  buffer.push(`  "${name}" {`);

  const uniqueColumnIds = getUniqueIndexColumnIds(state, table);

  query(state.collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .forEach(column => {
      buffer.push(`    ${formatAttribute(column, uniqueColumnIds)}`);
    });

  buffer.push('  }');
}

function formatAttribute(column: Column, uniqueColumnIds: Set<string>) {
  const dataType = column.dataType.trim();
  const type = dataType === '' ? UNKNOWN_TYPE : toAttributeWord(dataType);
  const nullable = bHas(column.options, ColumnOption.notNull) ? '' : '?';
  const parts = [`${type}${nullable}`, toAttributeWord(columnName(column))];
  const keys: string[] = [];

  if (bHas(column.options, ColumnOption.primaryKey)) {
    keys.push('PK');
  }
  if (bHas(column.ui.keys, ColumnUIKey.foreignKey)) {
    keys.push('FK');
  }
  if (
    bHas(column.options, ColumnOption.unique) ||
    uniqueColumnIds.has(column.id)
  ) {
    keys.push('UK');
  }

  if (keys.length !== 0) {
    parts.push(keys.join(', '));
  }
  if (column.comment.trim() !== '') {
    parts.push(`"${toQuoted(column.comment)}"`);
  }

  return joinAttribute(parts);
}

/**
 * The attribute line, every tilde in it written fullwidth when a part would
 * start the generic type rule's run, which would swallow the words after it.
 */
function joinAttribute(parts: string[]): string {
  const line = parts.join(' ');
  const swallows = parts.some((_, index) =>
    GENERIC_TYPE_RUN.test(parts.slice(index).join(' '))
  );

  return swallows ? line.replace(TILDE, FULLWIDTH_TILDE) : line;
}

/** The columns a unique index of the table keys alone; a composite one is an alternate key. */
function getUniqueIndexColumnIds(state: RootState, table: Table): Set<string> {
  return new Set(
    getUniqueIndexKeys(state, table)
      .filter(key => key.columnIds.length === 1)
      .map(key => key.columnIds[0])
  );
}

function formatRelationships(
  { doc: { relationshipIds }, collections }: RootState,
  entityNames: Map<string, string>
): string[] {
  const columns = query(collections).collection('tableColumnEntities');

  return query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds)
    .flatMap(relationship => {
      const parent = entityNames.get(relationship.start.tableId);
      const child = entityNames.get(relationship.end.tableId);
      const childCardinality = CHILD_CARDINALITY[relationship.relationshipType];

      if (
        parent === undefined ||
        child === undefined ||
        childCardinality === undefined
      ) {
        return [];
      }

      const label = columns
        .selectByIds(relationship.end.columnIds)
        .map(columnName)
        .join(', ');

      return [
        `  "${parent}" ${parentCardinality(relationship)}${
          relationship.identification ? '--' : '..'
        }${childCardinality} "${child}" : "${toQuoted(label)}"`,
      ];
    });
}

function parentCardinality(relationship: Relationship): string {
  return relationship.startRelationshipType === StartRelationshipType.ring
    ? '|o'
    : '||';
}

function columnName({ name }: Column): string {
  return name.trim() === '' ? UNNAMED : name;
}

function toEntityName(name: string): string {
  const value = name.replace(ENTITY_NAME_EXCLUDED, '');

  return value.trim() === '' ? UNNAMED : value;
}

function toAttributeWord(value: string): string {
  return ATTRIBUTE_WORD.test(value) && !ATTRIBUTE_KEY.test(value)
    ? value
    : `\`${value.replace(BACKTICK, "'")}\``;
}

function toQuoted(value: string): string {
  return value.replace(LINE_TERMINATOR, ' ').replace(DOUBLE_QUOTE, "'");
}

function uniqueName(used: Set<string>, name: string): string {
  let result = name;
  let index = 2;

  while (used.has(result)) {
    result = `${name}${index}`;
    index += 1;
  }

  used.add(result);
  return result;
}

import { query } from '@dineug/erd-editor-schema';
import { upperFirst } from 'es-toolkit';

import { ColumnOption } from '@/constants/schema';
import { PrimitiveTypeMap } from '@/constants/sql/dataType';
import { RootState } from '@/engine/state';
import { Column } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { orderByNameASC } from '@/utils/schema-sql/utils';

import { FormatTableOptions, getNameCase, getPrimitiveType } from './utils';

const convertTypeMap: PrimitiveTypeMap = {
  int: 'int32',
  long: 'int64',
  float: 'float32',
  double: 'float64',
  decimal: 'decimal.Decimal',
  boolean: 'bool',
  string: 'string',
  lob: 'string',
  date: 'time.Time',
  dateTime: 'time.Time',
  time: 'time.Time',
};

type Field = {
  name: string;
  type: string;
  tag: string;
  comment: string;
};

export function createCode(state: RootState): string {
  const {
    doc: { tableIds },
    collections,
  } = state;
  const stringBuffer: string[] = [''];
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds)
    .sort(orderByNameASC);

  tables.forEach(table => {
    formatTable(state, {
      buffer: stringBuffer,
      table,
    });
    stringBuffer.push('');
  });

  return stringBuffer.join('\n');
}

export function formatTable(
  state: RootState,
  { buffer, table }: FormatTableOptions
) {
  const {
    settings: { tableNameCase },
    collections,
  } = state;
  const structName = exported(getNameCase(table.name, tableNameCase));

  if (table.comment.trim() !== '') {
    buffer.push(`// ${table.comment}`);
  }
  buffer.push(`type ${structName} struct {`);

  const fields = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .map(column => createField(state, column));

  alignmentRunsOf(fields).forEach(run => {
    const nameWidth = Math.max(...run.map(field => field.name.length));
    const typeWidth = Math.max(...run.map(field => field.type.length));

    run.forEach(field => {
      if (field.comment !== '') {
        buffer.push(`\t// ${field.comment}`);
      }
      buffer.push(
        `\t${field.name.padEnd(nameWidth)} ${field.type.padEnd(typeWidth)} ${
          field.tag
        }`
      );
    });
  });

  buffer.push(`}`);
}

// gofmt's tabwriter ends a column block at the first line that is not a field,
// and a comment on its own line is one.
function alignmentRunsOf(fields: Field[]): Field[][] {
  const runs: Field[][] = [];

  fields.forEach(field => {
    if (field.comment !== '' || runs.length === 0) {
      runs.push([]);
    }
    runs[runs.length - 1].push(field);
  });

  return runs;
}

function createField(
  { settings: { columnNameCase, database } }: RootState,
  column: Column
): Field {
  const primitiveType = getPrimitiveType(column.dataType, database);
  const type = convertTypeMap[primitiveType];

  return {
    name: exported(getNameCase(column.name, columnNameCase)),
    type: bHas(column.options, ColumnOption.notNull) ? type : `*${type}`,
    tag: structTag(column.name),
    comment: column.comment.trim(),
  };
}

// reflect.StructTag unquotes the value, and the raw-string form cannot carry a
// backtick -- a column named with one falls back to the interpreted form.
function structTag(columnName: string): string {
  const tag = `json:"${escaped(columnName)}"`;

  return tag.includes('`') ? `"${escaped(tag)}"` : `\`${tag}\``;
}

function escaped(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

function exported(name: string): string {
  return upperFirst(name);
}

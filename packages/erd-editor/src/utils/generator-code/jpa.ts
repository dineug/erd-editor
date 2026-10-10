import { query } from '@dineug/erd-editor-schema';

import {
  BracketType,
  ColumnOption,
  ColumnUIKey,
  Database,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import {
  orderByNameASC,
  primaryKey,
  primaryKeyColumns,
} from '@/utils/schema-sql/utils';

import {
  ColumnScalar,
  ColumnType,
  getColumnType,
  isMySQLFamily,
} from './columnTypes';
import { DOCTRINE_RESERVED_WORDS } from './doctrineReservedWords';
import {
  escapeUnicodeEscapes,
  formatLineComment,
  toJavaClassName,
  toJavaFieldName,
} from './java';
import {
  FormatColumnOptions,
  FormatRelationOptions,
  FormatTableOptions,
  getNameCase,
  hasNRelationship,
  hasOneRelationship,
} from './utils';

const SCALAR_TYPES: Readonly<Record<ColumnScalar, string>> = {
  bool: 'Boolean',
  i8: 'Byte',
  i16: 'Short',
  i32: 'Integer',
  i64: 'Long',
  u8: 'Short',
  u16: 'Integer',
  u32: 'Long',
  u64: 'Long',
  f32: 'Float',
  f64: 'Double',
  decimal: 'BigDecimal',
  string: 'String',
  bytes: 'byte[]',
  uuid: 'UUID',
  json: 'String',
  date: 'LocalDate',
  time: 'LocalTime',
  // Hibernate moves an OffsetTime by the JVM's offset on the way in and out.
  timeTz: 'LocalTime',
  dateTime: 'LocalDateTime',
  dateTimeUtc: 'LocalDateTime',
  dateTimeOffset: 'OffsetDateTime',
  interval: 'String',
};

// Oracle's large objects, which Hibernate reads as a String or byte[] only
// under @Lob; any other type takes none.
const ORACLE_LOB_TYPES = new Set(['blob', 'clob', 'nclob']);

// The fixed-length binary types, MySQL's CHAR(n) BYTE spelling included, where
// Hibernate expects a byte[] in a VARBINARY.
const FIXED_BINARY_TYPES: Partial<Record<number, ReadonlySet<string>>> = {
  [Database.MariaDB]: new Set(['binary', 'char byte']),
  [Database.MSSQL]: new Set(['binary']),
  [Database.MySQL]: new Set(['binary', 'char byte']),
};

const UNSIGNED_DEFINITIONS: Partial<Record<ColumnScalar, string>> = {
  u8: 'TINYINT UNSIGNED',
  u16: 'SMALLINT UNSIGNED',
  u32: 'INT UNSIGNED',
};

// YEAR holds a u16 but stays a YEAR under UNSIGNED or ZEROFILL, so no integer
// definition fits it.
const YEAR_TYPES = new Set(['sql_tsi_year', 'year']);

const ZEROFILL = /(^|[^0-9a-z_])zerofill([^0-9a-z_]|$)/i;
const STRING_ESCAPES = /[\\"\n\r]/g;
const ESCAPED: Readonly<Record<string, string>> = {
  '\\': '\\\\',
  '"': '\\"',
  '\n': '\\n',
  '\r': '\\r',
};

type JavaColumnType = {
  javaType: string;
  isLob: boolean;
  columnDefinition: string | null;
  isGenerated: boolean;
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
    settings: { tableNameCase, columnNameCase, database, bracketType },
    doc: { relationshipIds },
    collections,
  } = state;
  const className = toClassName(table.name, tableNameCase);
  // Under a bracket type the DDL quotes the name, case kept, and Hibernate
  // quotes one wrapped in double quotes, which a reserved name needs. A name
  // the DDL leaves bare stays bare, so the database folds its case alike.
  const quotesTableName =
    bracketType !== BracketType.none && isReservedName(table.name);
  const idClassName = toClassName(`${table.name}Id`, tableNameCase);
  const tableCollection = query(collections).collection('tableEntities');
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds);
  const pkColumns = primaryKeyColumns(columns);

  if (pkColumns.length > 1) {
    buffer.push(`@Data`);
    buffer.push(`public class ${idClassName} implements Serializable {`);

    const pfkTables: Table[] = [];

    pkColumns.forEach(column => {
      if (
        bHas(column.ui.keys, ColumnUIKey.primaryKey) &&
        bHas(column.ui.keys, ColumnUIKey.foreignKey)
      ) {
        tableCollection
          .selectByIds(
            relationships
              .filter(relationship =>
                relationship.end.columnIds.includes(column.id)
              )
              .map(relationship => relationship.start.tableId)
          )
          .forEach(table => {
            if (!pfkTables.some(pfkTable => pfkTable.id === table.id)) {
              pfkTables.push(table);
            }
          });
      } else {
        const fieldName = toFieldName(column.name, columnNameCase);
        const { javaType } = getJavaColumnType(column, database);

        buffer.push(`  private ${javaType} ${fieldName};`);
      }
    });

    pfkTables.forEach(table => {
      buffer.push(
        `  private ${toClassName(table.name, tableNameCase)} ${toFieldName(
          table.name,
          columnNameCase
        )};`
      );
    });

    buffer.push(`}`);
  }

  formatLineComment(buffer, '', table.comment, escapeUnicodeEscapes);
  buffer.push(`@Data`);
  buffer.push(`@Entity`);

  if (className !== table.name || quotesTableName) {
    const tableName = quotesTableName ? `"${table.name}"` : table.name;

    buffer.push(`@Table(name = ${toStringLiteral(tableName)})`);
  }
  if (pkColumns.length > 1) {
    buffer.push(`@IdClass(${idClassName}.class)`);
  }

  buffer.push(`public class ${className} {`);

  columns.forEach(column => {
    formatColumn(state, { buffer, column });
  });
  formatRelation(state, { buffer, table });

  buffer.push(`}`);
}

function formatColumn(
  { settings: { columnNameCase, database } }: RootState,
  { buffer, column }: FormatColumnOptions
) {
  const isPK = bHas(column.ui.keys, ColumnUIKey.primaryKey);
  const isFK = bHas(column.ui.keys, ColumnUIKey.foreignKey);
  if ((!isPK && isFK) || (isPK && isFK)) {
    return;
  }

  const fieldName = toFieldName(column.name, columnNameCase);
  const { javaType, isLob, columnDefinition, isGenerated } = getJavaColumnType(
    column,
    database
  );
  const isId = bHas(column.options, ColumnOption.primaryKey);
  const attributes: string[] = [];

  if (fieldName !== column.name) {
    attributes.push(`name = ${toStringLiteral(column.name)}`);
  }
  // An @Id is never null, so a key column without the flag needs no attribute.
  if (!isId && bHas(column.options, ColumnOption.notNull)) {
    attributes.push(`nullable = false`);
  }
  if (isGenerated) {
    attributes.push(`insertable = false`, `updatable = false`);
  }
  if (columnDefinition !== null) {
    attributes.push(`columnDefinition = ${toStringLiteral(columnDefinition)}`);
  }

  formatLineComment(buffer, '  ', column.comment, escapeUnicodeEscapes);

  if (isId) {
    buffer.push(`  @Id`);

    if (bHas(column.options, ColumnOption.autoIncrement)) {
      buffer.push(`  @GeneratedValue(strategy = GenerationType.IDENTITY)`);
    }
  }
  if (attributes.length !== 0) {
    buffer.push(`  @Column(${attributes.join(', ')})`);
  }
  if (isLob) {
    buffer.push(`  @Lob`);
  }
  buffer.push(`  private ${javaType} ${fieldName};`);
}

function formatRelation(
  {
    doc: { relationshipIds },
    collections,
    settings: { tableNameCase, columnNameCase },
  }: RootState,
  { buffer, table }: FormatRelationOptions
) {
  const tableCollection = query(collections).collection('tableEntities');
  const columnCollection = query(collections).collection('tableColumnEntities');
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds);

  relationships
    .filter(relationship => relationship.end.tableId === table.id)
    .forEach(relationship => {
      const startTable = tableCollection.selectById(relationship.start.tableId);
      const endColumns = columnCollection.selectByIds(
        relationship.end.columnIds
      );

      if (startTable && endColumns.length !== 0) {
        const typeName = toClassName(startTable.name, tableNameCase);
        const fieldName = toFieldName(startTable.name, columnNameCase);

        formatLineComment(
          buffer,
          '  ',
          startTable.comment,
          escapeUnicodeEscapes
        );

        if (primaryKey(endColumns)) {
          buffer.push(`  @Id`);
        }

        if (hasOneRelationship(relationship.relationshipType)) {
          buffer.push(`  @OneToOne`);
        } else if (hasNRelationship(relationship.relationshipType)) {
          buffer.push(`  @ManyToOne`);
        }

        if (endColumns.length > 1) {
          buffer.push(`  @JoinColumns(value = {`);
          endColumns.forEach((column, index) => {
            buffer.push(
              `    @JoinColumn(name = ${toStringLiteral(column.name)})${
                endColumns.length - 1 > index ? ',' : ''
              }`
            );
          });
          buffer.push(`  })`);
        } else {
          buffer.push(
            `  @JoinColumn(name = ${toStringLiteral(endColumns[0].name)})`
          );
        }
        buffer.push(`  private ${typeName} ${fieldName};`);
      }
    });

  relationships
    .filter(relationship => relationship.start.tableId === table.id)
    .forEach(relationship => {
      const endTable = tableCollection.selectById(relationship.end.tableId);

      if (endTable) {
        const typeName = toClassName(endTable.name, tableNameCase);
        const fieldName = toFieldName(endTable.name, columnNameCase);
        const mappedBy = toFieldName(table.name, columnNameCase);

        formatLineComment(buffer, '  ', endTable.comment, escapeUnicodeEscapes);

        if (hasOneRelationship(relationship.relationshipType)) {
          buffer.push(`  @OneToOne(mappedBy = "${mappedBy}")`);
          buffer.push(`  private ${typeName} ${fieldName};`);
        } else if (hasNRelationship(relationship.relationshipType)) {
          buffer.push(`  @OneToMany(mappedBy = "${mappedBy}")`);
          buffer.push(
            `  private List<${typeName}> ${toFieldName(
              `${getNameCase(endTable.name, columnNameCase)}List`,
              columnNameCase
            )} = new ArrayList<>();`
          );
        }
      }
    });
}

/**
 * The Java type a column's data type maps to, one array level per PostgreSQL
 * dimension, with what the field needs besides: @Lob, a columnDefinition where
 * Hibernate's schema validation needs one, or a column the database writes.
 */
function getJavaColumnType(column: Column, database: number): JavaColumnType {
  const columnType = getColumnType(column.dataType, database);
  const { base, arrayDepth, isRowVersion } = columnType;

  return {
    javaType: `${scalarType(columnType, database)}${'[]'.repeat(arrayDepth)}`,
    isLob: database === Database.Oracle && ORACLE_LOB_TYPES.has(base),
    columnDefinition: getColumnDefinition(
      columnType,
      column.dataType,
      database
    ),
    isGenerated: isRowVersion,
  };
}

function scalarType(
  { scalar, bits, interval }: ColumnType,
  database: number
): string {
  // MEDIUMINT UNSIGNED stops below 2^24, which an Integer holds.
  if (scalar === 'u32' && bits === 24) {
    return 'Integer';
  }
  // Hibernate writes a Duration to a PostgreSQL interval under its
  // preferred_duration_jdbc_type setting, and to an Oracle one in no way.
  if (
    scalar === 'interval' &&
    interval !== 'yearMonth' &&
    database !== Database.Oracle
  ) {
    return 'Duration';
  }
  return SCALAR_TYPES[scalar];
}

/**
 * The column's own type where Hibernate's schema validation refuses the field
 * without it: PostgreSQL money, a fixed BINARY, and the MySQL unsigned
 * integers whose Java type is wider than the signed type the driver reports.
 */
function getColumnDefinition(
  { scalar, base, args, bits, isUnsigned }: ColumnType,
  dataType: string,
  database: number
): string | null {
  if (database === Database.PostgreSQL) {
    return base === 'money' ? dataType : null;
  }
  // Hibernate compares the definition up to its first parenthesis with the
  // name the driver reports, which drops the display width, and on MySQL also
  // ZEROFILL, which MariaDB keeps.
  if (FIXED_BINARY_TYPES[database]?.has(base)) {
    return args.length === 0 ? 'BINARY' : `BINARY(${args[0]})`;
  }

  const definition =
    isMySQLFamily(database) &&
    isUnsigned &&
    bits !== 24 &&
    !YEAR_TYPES.has(base) &&
    UNSIGNED_DEFINITIONS[scalar];

  if (!definition) {
    return null;
  }
  return database === Database.MariaDB && ZEROFILL.test(dataType)
    ? `${definition} ZEROFILL`
    : definition;
}

function toStringLiteral(value: string): string {
  return `"${value.replace(STRING_ESCAPES, char => ESCAPED[char])}"`;
}

function isReservedName(name: string): boolean {
  return DOCTRINE_RESERVED_WORDS.has(name.toLowerCase());
}

/** The class name java.ts writes, so both generators repair names alike. */
function toClassName(name: string, nameCase: number): string {
  return toJavaClassName(getNameCase(name, nameCase));
}

/**
 * The field name java.ts writes, Class_ included, every relation field,
 * mappedBy and @IdClass field among them, so each side names one field.
 */
function toFieldName(name: string, nameCase: number): string {
  return toJavaFieldName(getNameCase(name, nameCase));
}

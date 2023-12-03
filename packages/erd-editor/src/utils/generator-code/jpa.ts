import { ColumnOption, ColumnUIKey, NameCase } from '@/constants/schema';
import { PrimitiveTypeMap } from '@/constants/sql/dataType';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { query } from '@/utils/collection/query';
import {
  orderByNameASC,
  primaryKey,
  primaryKeyColumns,
} from '@/utils/schema-sql/utils';

import {
  FormatColumnOptions,
  FormatRelationOptions,
  FormatTableOptions,
  getNameCase,
  getPrimitiveType,
  hasNRelationship,
  hasOneRelationship,
} from './utils';

const convertTypeMap: PrimitiveTypeMap = {
  int: 'Integer',
  long: 'Long',
  float: 'Float',
  double: 'Double',
  decimal: 'BigDecimal',
  boolean: 'Boolean',
  string: 'String',
  lob: 'String',
  date: 'LocalDate',
  dateTime: 'LocalDateTime',
  time: 'LocalTime',
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
    settings: { tableNameCase, columnNameCase, database },
    doc: { relationshipIds },
    collections,
  } = state;
  const tableName = getNameCase(table.name, tableNameCase);
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
    buffer.push(
      `public class ${getNameCase(
        `${table.name}Id`,
        tableNameCase
      )} implements Serializable {`
    );

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
        const columnName = getNameCase(column.name, columnNameCase);
        const primitiveType = getPrimitiveType(column.dataType, database);

        buffer.push(
          `  private ${convertTypeMap[primitiveType]} ${columnName};`
        );
      }
    });

    pfkTables.forEach(table => {
      buffer.push(
        `  private ${getNameCase(table.name, tableNameCase)} ${getNameCase(
          table.name,
          columnNameCase
        )};`
      );
    });

    buffer.push(`}`);
  }

  if (table.comment.trim() !== '') {
    buffer.push(`// ${table.comment}`);
  }
  buffer.push(`@Data`);
  buffer.push(`@Entity`);

  if (pkColumns.length > 1) {
    buffer.push(
      `@IdClass(${getNameCase(`${table.name}Id`, tableNameCase)}.class)`
    );
  }

  buffer.push(`public class ${tableName} {`);

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

  const columnName = getNameCase(column.name, columnNameCase);
  const primitiveType = getPrimitiveType(column.dataType, database);

  if (column.comment.trim() !== '') {
    buffer.push(`  // ${column.comment}`);
  }

  if (bHas(column.options, ColumnOption.primaryKey)) {
    buffer.push(`  @Id`);

    if (bHas(column.options, ColumnOption.autoIncrement)) {
      buffer.push(`  @GeneratedValue`);
    }
  } else if (bHas(column.options, ColumnOption.notNull)) {
    buffer.push(`  @Column(nullable = false)`);
  }

  if (primitiveType === 'lob') {
    buffer.push(`  @Lob`);
  }
  buffer.push(`  private ${convertTypeMap[primitiveType]} ${columnName};`);
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
        const typeName = getNameCase(startTable.name, tableNameCase);
        const fieldName = getNameCase(startTable.name, columnNameCase);

        if (startTable.comment.trim() !== '') {
          buffer.push(`  // ${startTable.comment}`);
        }

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
              `    @JoinColumn(name = "${getNameCase(
                column.name,
                NameCase.snakeCase
              )}")${endColumns.length - 1 > index ? ',' : ''}`
            );
          });
          buffer.push(`  })`);
        } else {
          buffer.push(
            `  @JoinColumn(name = "${getNameCase(
              endColumns[0].name,
              NameCase.snakeCase
            )}")`
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
        const typeName = getNameCase(endTable.name, tableNameCase);
        const fieldName = getNameCase(endTable.name, columnNameCase);

        if (endTable.comment.trim() !== '') {
          buffer.push(`  // ${endTable.comment}`);
        }

        if (hasOneRelationship(relationship.relationshipType)) {
          buffer.push(
            `  @OneToOne(mappedBy = "${getNameCase(
              table.name,
              columnNameCase
            )}")`
          );
          buffer.push(`  private ${typeName} ${fieldName};`);
        } else if (hasNRelationship(relationship.relationshipType)) {
          buffer.push(
            `  @OneToMany(mappedBy = "${getNameCase(
              table.name,
              columnNameCase
            )}")`
          );
          buffer.push(
            `  private List<${typeName}> ${getNameCase(
              `${fieldName}List`,
              columnNameCase
            )} = new ArrayList<>();`
          );
        }
      }
    });
}

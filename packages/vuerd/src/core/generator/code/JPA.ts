import { Store } from '@@types/engine/store';
import { Table, Column } from '@@types/engine/store/table.state';
import { Database, NameCase } from '@@types/engine/store/canvas.state';
import { Relationship } from '@@types/engine/store/relationship.state';
import {
  oneRelationshipTypes,
  nRelationshipTypes,
} from '@/engine/store/relationship.state';
import { getPrimitiveType, getNameCase } from './helper';
import { orderByNameASC } from '@/engine/store/helper/table.helper';
import { getData } from '@/core/helper';
import { PrimitiveTypeMap } from '@/core/sql/dataType';
import { primaryKey, primaryKeyColumns } from '@/core/sql/ddl/helper';

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

export function createCode(store: Store): string {
  const stringBuffer: string[] = [''];
  const { database, tableCase, columnCase } = store.canvasState;
  const tables = orderByNameASC(store.tableState.tables);
  const relationships = store.relationshipState.relationships;

  tables.forEach(table => {
    formatTable(
      table,
      stringBuffer,
      database,
      relationships,
      tables,
      tableCase,
      columnCase
    );
    stringBuffer.push('');
  });

  return stringBuffer.join('\n');
}

export function formatTable(
  table: Table,
  buffer: string[],
  database: Database,
  relationships: Relationship[],
  tables: Table[],
  tableCase: NameCase,
  columnCase: NameCase
) {
  const tableName = getNameCase(table.name, tableCase);
  const pkColumns = primaryKeyColumns(table.columns);
  if (pkColumns.length > 1) {
    buffer.push(`@Data`);
    buffer.push(
      `public class ${getNameCase(
        `${table.name}Id`,
        tableCase
      )} implements Serializable {`
    );
    const pfkTables: Table[] = [];
    pkColumns.forEach(column => {
      if (column.ui.pfk) {
        (
          relationships
            .filter(relationship =>
              relationship.end.columnIds.includes(column.id)
            )
            .map(relationship => getData(tables, relationship.start.tableId))
            .filter(table => table !== null) as Table[]
        ).forEach(table => {
          if (!pfkTables.some(pfkTable => pfkTable.id === table.id)) {
            pfkTables.push(table);
          }
        });
      } else {
        const columnName = getNameCase(column.name, columnCase);
        const primitiveType = getPrimitiveType(column.dataType, database);
        buffer.push(
          `  private ${convertTypeMap[primitiveType]} ${columnName};`
        );
      }
    });
    pfkTables.forEach(table => {
      buffer.push(
        `  private ${getNameCase(table.name, tableCase)} ${getNameCase(
          table.name,
          columnCase
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
    buffer.push(`@IdClass(${getNameCase(`${table.name}Id`, tableCase)}.class)`);
  }
  // if (unique(table.columns)) {
  //   const uqColumns = uniqueColumns(table.columns).map(column => {
  //     return { name: getNameCase(column.name, Case.snakeCase) };
  //   });
  //   buffer.push(`@Table(uniqueConstraints = {`);
  //   buffer.push(`  @UniqueConstraint(`);
  //   buffer.push(`    columnNames={${formatNames(uqColumns, '"')}}`);
  //   buffer.push(`  )`);
  //   buffer.push(`})`);
  // }
  buffer.push(`public class ${tableName} {`);
  table.columns.forEach(column => {
    formatColumn(column, buffer, database, columnCase);
  });
  formatRelation(table, buffer, relationships, tables, tableCase, columnCase);
  buffer.push(`}`);
}

function formatColumn(
  column: Column,
  buffer: string[],
  database: Database,
  columnCase: NameCase
) {
  if (!column.ui.fk && !column.ui.pfk) {
    const columnName = getNameCase(column.name, columnCase);
    const primitiveType = getPrimitiveType(column.dataType, database);
    if (column.comment.trim() !== '') {
      buffer.push(`  // ${column.comment}`);
    }
    if (column.option.primaryKey) {
      buffer.push(`  @Id`);
      if (column.option.autoIncrement) {
        buffer.push(`  @GeneratedValue`);
      }
    } else if (column.option.notNull) {
      buffer.push(`  @Column(nullable = false)`);
    }
    if (primitiveType === 'lob') {
      buffer.push(`  @Lob`);
    }
    buffer.push(`  private ${convertTypeMap[primitiveType]} ${columnName};`);
  }
}

function formatRelation(
  table: Table,
  buffer: string[],
  relationships: Relationship[],
  tables: Table[],
  tableCase: NameCase,
  columnCase: NameCase
) {
  relationships
    .filter(relationship => relationship.end.tableId === table.id)
    .forEach(relationship => {
      const startTable = getData(tables, relationship.start.tableId);
      const endColumns = relationship.end.columnIds
        .map(columnId => getData(table.columns, columnId))
        .filter(column => column !== null) as Column[];
      if (startTable && endColumns.length !== 0) {
        const typeName = getNameCase(startTable.name, tableCase);
        const fieldName = getNameCase(startTable.name, columnCase);
        if (startTable.comment.trim() !== '') {
          buffer.push(`  // ${startTable.comment}`);
        }
        if (primaryKey(endColumns)) {
          buffer.push(`  @Id`);
        }
        if (oneRelationshipTypes.includes(relationship.relationshipType)) {
          buffer.push(`  @OneToOne`);
        } else if (nRelationshipTypes.includes(relationship.relationshipType)) {
          buffer.push(`  @ManyToOne`);
        }

        if (endColumns.length > 1) {
          buffer.push(`  @JoinColumns(value = {`);
          endColumns.forEach((column, index) => {
            buffer.push(
              `    @JoinColumn(name = "${getNameCase(
                column.name,
                'snakeCase'
              )}")${endColumns.length - 1 > index ? ',' : ''}`
            );
          });
          buffer.push(`  })`);
        } else {
          buffer.push(
            `  @JoinColumn(name = "${getNameCase(
              endColumns[0].name,
              'snakeCase'
            )}")`
          );
        }
        buffer.push(`  private ${typeName} ${fieldName};`);
      }
    });
  relationships
    .filter(relationship => relationship.start.tableId === table.id)
    .forEach(relationship => {
      const endTable = getData(tables, relationship.end.tableId);
      if (endTable) {
        const typeName = getNameCase(endTable.name, tableCase);
        const fieldName = getNameCase(endTable.name, columnCase);
        if (endTable.comment.trim() !== '') {
          buffer.push(`  // ${endTable.comment}`);
        }
        if (oneRelationshipTypes.includes(relationship.relationshipType)) {
          buffer.push(
            `  @OneToOne(mappedBy = "${getNameCase(table.name, columnCase)}")`
          );
          buffer.push(`  private ${typeName} ${fieldName};`);
        } else if (nRelationshipTypes.includes(relationship.relationshipType)) {
          buffer.push(
            `  @OneToMany(mappedBy = "${getNameCase(table.name, columnCase)}")`
          );
          buffer.push(
            `  private List<${typeName}> ${getNameCase(
              `${fieldName}List`,
              columnCase
            )} = new ArrayList<>();`
          );
        }
      }
    });
}

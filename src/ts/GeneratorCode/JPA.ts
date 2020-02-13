import StoreManagement from "@/store/StoreManagement";
import { Column, Table } from "@/store/table";
import { getNameCase, getPrimitiveType } from "../GeneratorCodeHelper";
import { Database } from "@/data/DataType";
import { Case } from "@/ts/GeneratorCode";
import { Relationship, RelationshipType } from "@/store/relationship";
import { getData, isData } from "@/ts/util";
import {
  primaryKey,
  primaryKeyColumns,
  unique,
  uniqueColumns,
  formatNames
} from "@/ts/SQLHelper";

const typescriptType: { [key: string]: string } = {
  int: "Integer",
  long: "Long",
  float: "Float",
  double: "Double",
  decimal: "BigDecimal",
  boolean: "Boolean",
  string: "String",
  lob: "String",
  date: "LocalDate",
  dateTime: "LocalDateTime",
  time: "LocalTime"
};

class JPA {
  public toCode(store: StoreManagement): string {
    const stringBuffer: string[] = [];
    const tables = store.tableStore.state.tables;
    const relationships = store.relationshipStore.state.relationships;
    const database = store.canvasStore.state.database;
    const tableCase = store.canvasStore.state.tableCase;
    const columnCase = store.canvasStore.state.columnCase;

    tables.forEach(table => {
      this.formatTable(
        table,
        stringBuffer,
        database,
        relationships,
        tables,
        tableCase,
        columnCase
      );
      stringBuffer.push("");
    });

    return stringBuffer.join("\n");
  }

  private formatTable(
    table: Table,
    buffer: string[],
    database: Database,
    relationships: Relationship[],
    tables: Table[],
    tableCase: Case,
    columnCase: Case
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
          (relationships
            .filter(relationship =>
              relationship.end.columnIds.some(
                columnId => columnId === column.id
              )
            )
            .map(relationship => getData(tables, relationship.start.tableId))
            .filter(table => table !== null) as Table[]).forEach(table => {
            if (isData(pfkTables, table.id)) {
              pfkTables.push(table);
            }
          });
        } else {
          const columnName = getNameCase(column.name, columnCase);
          const primitiveType = getPrimitiveType(column.dataType, database);
          buffer.push(
            `  private ${typescriptType[primitiveType]} ${columnName};`
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
    if (table.comment.trim() !== "") {
      buffer.push(`// ${table.comment}`);
    }
    buffer.push(`@Data`);
    buffer.push(`@Entity`);
    if (pkColumns.length > 1) {
      buffer.push(
        `@IdClass(${getNameCase(`${table.name}Id`, tableCase)}.class)`
      );
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
      this.formatColumn(column, buffer, database, columnCase);
    });
    this.formatRelation(
      table,
      buffer,
      relationships,
      tables,
      tableCase,
      columnCase
    );
    buffer.push(`}`);
  }

  private formatColumn(
    column: Column,
    buffer: string[],
    database: Database,
    columnCase: Case
  ) {
    if (!column.ui.fk && !column.ui.pfk) {
      const columnName = getNameCase(column.name, columnCase);
      const primitiveType = getPrimitiveType(column.dataType, database);
      if (column.comment.trim() !== "") {
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
      if (primitiveType === "lob") {
        buffer.push(`  @Lob`);
      }
      buffer.push(`  private ${typescriptType[primitiveType]} ${columnName};`);
    }
  }

  private formatRelation(
    table: Table,
    buffer: string[],
    relationships: Relationship[],
    tables: Table[],
    tableCase: Case,
    columnCase: Case
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
          if (startTable.comment.trim() !== "") {
            buffer.push(`  // ${startTable.comment}`);
          }
          if (primaryKey(endColumns)) {
            buffer.push(`  @Id`);
          }
          if (relationship.relationshipType === RelationshipType.ZeroOne) {
            buffer.push(`  @OneToOne`);
          } else if (
            relationship.relationshipType === RelationshipType.ZeroOneN
          ) {
            buffer.push(`  @ManyToOne`);
          }

          if (endColumns.length > 1) {
            buffer.push(`  @JoinColumns(value = {`);
            endColumns.forEach((column, index) => {
              buffer.push(
                `    @JoinColumn(name = "${getNameCase(
                  column.name,
                  Case.snakeCase
                )}")${endColumns.length - 1 > index ? "," : ""}`
              );
            });
            buffer.push(`  })`);
          } else {
            buffer.push(
              `  @JoinColumn(name = "${getNameCase(
                endColumns[0].name,
                Case.snakeCase
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
          if (endTable.comment.trim() !== "") {
            buffer.push(`  // ${endTable.comment}`);
          }
          if (relationship.relationshipType === RelationshipType.ZeroOne) {
            buffer.push(
              `  @OneToOne(mappedBy = "${getNameCase(table.name, columnCase)}")`
            );
            buffer.push(`  private ${typeName} ${fieldName};`);
          } else if (
            relationship.relationshipType === RelationshipType.ZeroOneN
          ) {
            buffer.push(
              `  @OneToMany(mappedBy = "${getNameCase(
                table.name,
                columnCase
              )}")`
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
}

export default new JPA();

import StoreManagement from "@/store/StoreManagement";
import { Table, Column } from "@/store/table";
import { getPrimitiveType, getNameCase } from "../GeneratorCodeHelper";
import { Database } from "@/data/DataType";
import { Case } from "@/ts/GeneratorCode";
import { Relationship, RelationshipType } from "@/store/relationship";
import { getData } from "@/ts/util";
import { primaryKeyColumns } from "@/ts/SQLHelper";

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
      pkColumns.forEach(column => {
        const columnName = getNameCase(column.name, columnCase);
        const primitiveType = getPrimitiveType(column.dataType, database);
        buffer.push(
          `  private ${typescriptType[primitiveType]} ${columnName};`
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
        const endColumns = relationship.end.columnIds.map(
          columnId => getData(table.columns, columnId) as Column
        );
        if (startTable && endColumns.length !== 0) {
          const typeName = getNameCase(startTable.name, tableCase);
          const fieldName = getNameCase(startTable.name, columnCase);
          if (startTable.comment.trim() !== "") {
            buffer.push(`  // ${startTable.comment}`);
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
                `    @JoinColumn(name = "${column.name}")${
                  endColumns.length - 1 > index ? "," : ""
                }`
              );
            });
            buffer.push(`  })`);
          } else {
            buffer.push(`  @JoinColumn(name = "${endColumns[0].name}")`);
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

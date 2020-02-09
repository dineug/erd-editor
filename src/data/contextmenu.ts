import StoreManagement from "@/store/StoreManagement";
import Menu from "@/models/Menu";
import { Commit as TableCommit } from "@/store/table";
import { Commit as MemoCommit } from "@/store/memo";
import {
  Commit as RelationshipCommit,
  RelationshipType
} from "@/store/relationship";
import { Commit as CanvasCommit, ShowKey } from "@/store/canvas";
import { Bus } from "@/ts/EventBus";
import icon from "@/ts/icon";
import { uuid } from "@/ts/util";
import { Database } from "./DataType";
import { Case, Language } from "@/ts/GeneratorCode";
import File from "@/ts/File";

function dataMenu(store: StoreManagement): Menu[] {
  const show = store.canvasStore.state.show;
  const database = store.canvasStore.state.database;
  return [
    {
      id: uuid(),
      name: "New Table",
      keymap: "Alt + N",
      icon: "table",
      execute() {
        store.tableStore.commit(TableCommit.tableAdd, store);
      }
    },
    {
      id: uuid(),
      name: "New Memo",
      keymap: "Alt + M",
      icon: "sticky-note",
      execute() {
        store.memoStore.commit(MemoCommit.memoAdd, store);
      }
    },
    {
      id: uuid(),
      name: "Primary Key",
      keymap: "Alt + K",
      icon: "key",
      execute() {
        store.tableStore.commit(TableCommit.columnPrimaryKey);
      }
    },
    {
      id: uuid(),
      name: "1 : 1",
      keymap: "Alt + 1",
      icon: icon[RelationshipType.ZeroOne],
      base64: true,
      execute() {
        store.relationshipStore.commit(
          RelationshipCommit.relationshipDrawStart,
          {
            store,
            relationshipType: RelationshipType.ZeroOne
          }
        );
      }
    },
    {
      id: uuid(),
      name: "1 : N",
      keymap: "Alt + 2",
      icon: icon[RelationshipType.ZeroOneN],
      base64: true,
      execute() {
        store.relationshipStore.commit(
          RelationshipCommit.relationshipDrawStart,
          {
            store,
            relationshipType: RelationshipType.ZeroOneN
          }
        );
      }
    },
    {
      id: uuid(),
      name: "View Option",
      icon: "eye",
      children: [
        {
          id: uuid(),
          icon: show.tableComment ? "check" : undefined,
          name: "Table Comment",
          execute() {
            store.canvasStore.commit(CanvasCommit.showChange, {
              showKey: ShowKey.tableComment,
              store
            });
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, show: ShowKey.tableComment }
        },
        {
          id: uuid(),
          icon: show.columnComment ? "check" : undefined,
          name: "Column Comment",
          execute() {
            store.canvasStore.commit(CanvasCommit.showChange, {
              showKey: ShowKey.columnComment,
              store
            });
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, show: ShowKey.columnComment }
        },
        {
          id: uuid(),
          icon: show.columnDataType ? "check" : undefined,
          name: "dataType",
          execute() {
            store.canvasStore.commit(CanvasCommit.showChange, {
              showKey: ShowKey.columnDataType,
              store
            });
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, show: ShowKey.columnDataType }
        },
        {
          id: uuid(),
          icon: show.columnNotNull ? "check" : undefined,
          name: "Not Null",
          execute() {
            store.canvasStore.commit(CanvasCommit.showChange, {
              showKey: ShowKey.columnNotNull,
              store
            });
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, show: ShowKey.columnNotNull }
        },
        {
          id: uuid(),
          icon: show.columnDefault ? "check" : undefined,
          name: "Default",
          execute() {
            store.canvasStore.commit(CanvasCommit.showChange, {
              showKey: ShowKey.columnDefault,
              store
            });
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, show: ShowKey.columnDefault }
        },
        {
          id: uuid(),
          icon: show.relationship ? "check" : undefined,
          name: "Relationship",
          execute() {
            store.canvasStore.commit(CanvasCommit.showChange, {
              showKey: ShowKey.relationship,
              store
            });
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, show: ShowKey.relationship }
        }
      ]
    },
    {
      id: uuid(),
      name: "Database",
      icon: "database",
      children: [
        {
          id: uuid(),
          icon: database === Database.MySQL ? "check" : undefined,
          name: Database.MySQL,
          execute() {
            store.canvasStore.commit(
              CanvasCommit.databaseChange,
              Database.MySQL
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, database: Database.MySQL }
        },
        {
          id: uuid(),
          icon: database === Database.MariaDB ? "check" : undefined,
          name: Database.MariaDB,
          execute() {
            store.canvasStore.commit(
              CanvasCommit.databaseChange,
              Database.MariaDB
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, database: Database.MariaDB }
        },
        {
          id: uuid(),
          icon: database === Database.PostgreSQL ? "check" : undefined,
          name: Database.PostgreSQL,
          execute() {
            store.canvasStore.commit(
              CanvasCommit.databaseChange,
              Database.PostgreSQL
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, database: Database.PostgreSQL }
        },
        {
          id: uuid(),
          icon: database === Database.Oracle ? "check" : undefined,
          name: Database.Oracle,
          execute() {
            store.canvasStore.commit(
              CanvasCommit.databaseChange,
              Database.Oracle
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, database: Database.Oracle }
        },
        {
          id: uuid(),
          icon: database === Database.MSSQL ? "check" : undefined,
          name: Database.MSSQL,
          execute() {
            store.canvasStore.commit(
              CanvasCommit.databaseChange,
              Database.MSSQL
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, database: Database.MSSQL }
        }
      ]
    },
    {
      id: uuid(),
      name: "Import",
      icon: "file-import",
      children: [
        {
          id: uuid(),
          name: "json",
          execute() {
            File.importJSON(store);
          }
        },
        {
          id: uuid(),
          name: `SQL DDL ${Database.MySQL}`,
          execute() {
            File.importSQL(store, Database.MySQL);
          }
        },
        {
          id: uuid(),
          name: `SQL DDL ${Database.MariaDB}`,
          execute() {
            File.importSQL(store, Database.MariaDB);
          }
        }
      ]
    },
    {
      id: uuid(),
      name: "Export",
      icon: "file-export",
      children: [
        {
          id: uuid(),
          name: "json",
          execute() {
            File.exportJSON(store.value, store.canvasStore.state.databaseName);
          }
        },
        {
          id: uuid(),
          name: "png",
          icon: "file-image",
          execute() {
            File.exportPNG(store.uuid, store.canvasStore.state.databaseName);
          }
        }
      ]
    }
  ];
}

function dataMenuCode(store: StoreManagement): Menu[] {
  const language = store.canvasStore.state.language;
  const tableCase = store.canvasStore.state.tableCase;
  const columnCase = store.canvasStore.state.columnCase;
  return [
    {
      id: uuid(),
      icon: "code",
      name: "Language",
      children: [
        {
          id: uuid(),
          icon: language === Language.graphql ? "check" : undefined,
          name: "GraphQL",
          execute() {
            store.canvasStore.commit(
              CanvasCommit.generatorLanguageChange,
              Language.graphql
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, language: Language.graphql }
        },
        {
          id: uuid(),
          icon: language === Language.cs ? "check" : undefined,
          name: "C#",
          execute() {
            store.canvasStore.commit(
              CanvasCommit.generatorLanguageChange,
              Language.cs
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, language: Language.cs }
        },
        {
          id: uuid(),
          icon: language === Language.java ? "check" : undefined,
          name: "Java",
          execute() {
            store.canvasStore.commit(
              CanvasCommit.generatorLanguageChange,
              Language.java
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, language: Language.java }
        },
        {
          id: uuid(),
          icon: language === Language.kotlin ? "check" : undefined,
          name: "Kotlin",
          execute() {
            store.canvasStore.commit(
              CanvasCommit.generatorLanguageChange,
              Language.kotlin
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, language: Language.kotlin }
        },
        {
          id: uuid(),
          icon: language === Language.typescript ? "check" : undefined,
          name: "TypeScript",
          execute() {
            store.canvasStore.commit(
              CanvasCommit.generatorLanguageChange,
              Language.typescript
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, language: Language.typescript }
        },
        {
          id: uuid(),
          icon: language === Language.JPA ? "check" : undefined,
          name: Language.JPA,
          execute() {
            store.canvasStore.commit(
              CanvasCommit.generatorLanguageChange,
              Language.JPA
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, language: Language.JPA }
        }
      ]
    },
    {
      id: uuid(),
      icon: "table",
      name: "Table Name Case",
      children: [
        {
          id: uuid(),
          icon: tableCase === Case.none ? "check" : undefined,
          name: "None",
          execute() {
            store.canvasStore.commit(
              CanvasCommit.generatorTableCaseChange,
              Case.none
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, tableCase: Case.none }
        },
        {
          id: uuid(),
          icon: tableCase === Case.camelCase ? "check" : undefined,
          name: "Camel",
          execute() {
            store.canvasStore.commit(
              CanvasCommit.generatorTableCaseChange,
              Case.camelCase
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, tableCase: Case.camelCase }
        },
        {
          id: uuid(),
          icon: tableCase === Case.pascalCase ? "check" : undefined,
          name: "Pascal",
          execute() {
            store.canvasStore.commit(
              CanvasCommit.generatorTableCaseChange,
              Case.pascalCase
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, tableCase: Case.pascalCase }
        },
        {
          id: uuid(),
          icon: tableCase === Case.snakeCase ? "check" : undefined,
          name: "Snake",
          execute() {
            store.canvasStore.commit(
              CanvasCommit.generatorTableCaseChange,
              Case.snakeCase
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, tableCase: Case.snakeCase }
        }
      ]
    },
    {
      id: uuid(),
      icon: "columns",
      name: "Column Name Case",
      children: [
        {
          id: uuid(),
          icon: columnCase === Case.none ? "check" : undefined,
          name: "None",
          execute() {
            store.canvasStore.commit(
              CanvasCommit.generatorColumnCaseChange,
              Case.none
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, columnCase: Case.none }
        },
        {
          id: uuid(),
          icon: columnCase === Case.camelCase ? "check" : undefined,
          name: "Camel",
          execute() {
            store.canvasStore.commit(
              CanvasCommit.generatorColumnCaseChange,
              Case.camelCase
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, columnCase: Case.camelCase }
        },
        {
          id: uuid(),
          icon: columnCase === Case.pascalCase ? "check" : undefined,
          name: "Pascal",
          execute() {
            store.canvasStore.commit(
              CanvasCommit.generatorColumnCaseChange,
              Case.pascalCase
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, columnCase: Case.pascalCase }
        },
        {
          id: uuid(),
          icon: columnCase === Case.snakeCase ? "check" : undefined,
          name: "Snake",
          execute() {
            store.canvasStore.commit(
              CanvasCommit.generatorColumnCaseChange,
              Case.snakeCase
            );
            store.eventBus.$emit(Bus.ERD.change);
          },
          option: { close: false, columnCase: Case.snakeCase }
        }
      ]
    }
  ];
}

export { dataMenu, dataMenuCode };

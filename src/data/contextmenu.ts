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
import { Language } from "@/ts/GeneratorCode";
import domToImage from "dom-to-image";

const a = document.createElement("a");

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
      icon: "code",
      children: [
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
        },
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
          name: "png",
          icon: "file-image",
          execute() {
            const canvas = document.getElementById(store.uuid);
            if (canvas) {
              canvas.style.backgroundColor = "#282828";
              domToImage
                .toBlob(canvas)
                .then(blob => {
                  a.href = window.URL.createObjectURL(blob);
                  if (store.canvasStore.state.databaseName.trim() === "") {
                    a.download = `unnamed-${new Date().getTime()}.png`;
                  } else {
                    a.download = `${
                      store.canvasStore.state.databaseName
                    }-${new Date().getTime()}.png`;
                  }
                  a.click();
                })
                .finally(() => {
                  canvas.style.backgroundColor = null;
                });
            }
          }
        }
      ]
    }
  ];
}

function dataMenuCode(store: StoreManagement): Menu[] {
  const language = store.canvasStore.state.language;
  return [
    {
      id: uuid(),
      icon: language === Language.graphql ? "check" : undefined,
      name: Language.graphql,
      execute() {
        store.canvasStore.commit(CanvasCommit.languageChange, Language.graphql);
        store.eventBus.$emit(Bus.ERD.change);
      },
      option: { close: false, language: Language.graphql }
    },
    {
      id: uuid(),
      icon: language === Language.cs ? "check" : undefined,
      name: Language.cs,
      execute() {
        store.canvasStore.commit(CanvasCommit.languageChange, Language.cs);
        store.eventBus.$emit(Bus.ERD.change);
      },
      option: { close: false, language: Language.cs }
    },
    {
      id: uuid(),
      icon: language === Language.java ? "check" : undefined,
      name: Language.java,
      execute() {
        store.canvasStore.commit(CanvasCommit.languageChange, Language.java);
        store.eventBus.$emit(Bus.ERD.change);
      },
      option: { close: false, language: Language.java }
    },
    {
      id: uuid(),
      icon: language === Language.kotlin ? "check" : undefined,
      name: Language.kotlin,
      execute() {
        store.canvasStore.commit(CanvasCommit.languageChange, Language.kotlin);
        store.eventBus.$emit(Bus.ERD.change);
      },
      option: { close: false, language: Language.kotlin }
    },
    {
      id: uuid(),
      icon: language === Language.typescript ? "check" : undefined,
      name: Language.typescript,
      execute() {
        store.canvasStore.commit(
          CanvasCommit.languageChange,
          Language.typescript
        );
        store.eventBus.$emit(Bus.ERD.change);
      },
      option: { close: false, language: Language.typescript }
    }
  ];
}

export { dataMenu, dataMenuCode };

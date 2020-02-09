import StoreManagement from "@/store/StoreManagement";
import { Database } from "@/data/DataType";
import domToImage from "dom-to-image";
import { Commit as TableCommit } from "@/store/table";
// @ts-ignore
import Parser from "sql-ddl-to-json-schema";
import { Bus } from "@/ts/EventBus";
import ParserJsonConvertERD from "./ParserJsonConvertERD";

class File {
  private exportA = document.createElement("a");
  private importInputJSON = document.createElement("input");
  private importInputSQL = document.createElement("input");
  private currentDatabase = Database.MySQL;
  private store: StoreManagement | null = null;
  private parserMySQL = new Parser("mysql");

  constructor() {
    this.importInputJSON.setAttribute("type", "file");
    this.importInputJSON.setAttribute("accept", ".json");
    this.importInputJSON.addEventListener("change", e => {
      const input = e.target as HTMLInputElement;
      if (input && input.files) {
        const f = input.files[0];
        if (/\.(json)$/i.test(f.name)) {
          const reader = new FileReader();
          reader.readAsText(f);
          reader.onload = () => {
            const value = reader.result as string;
            if (this.store && value) {
              this.store.load(value);
              this.store.eventBus.$emit(Bus.ERD.scroll);
            }
            this.importInputJSON.value = "";
          };
        } else {
          alert("Just upload the json file");
        }
      }
    });

    this.importInputSQL.setAttribute("type", "file");
    this.importInputSQL.setAttribute("accept", ".sql");
    this.importInputSQL.addEventListener("change", e => {
      const input = e.target as HTMLInputElement;
      if (input && input.files) {
        const f = input.files[0];
        if (/\.(sql)$/i.test(f.name)) {
          const reader = new FileReader();
          reader.readAsText(f);
          reader.onload = () => {
            const value = reader.result as string;
            if (
              value &&
              (this.currentDatabase === Database.MySQL ||
                this.currentDatabase === Database.MariaDB)
            ) {
              try {
                const tables = this.parserMySQL.feed(value).toCompactJson();
                const json = ParserJsonConvertERD.toERD(
                  tables,
                  this.currentDatabase
                );
                if (this.store) {
                  this.store.load(json);
                  this.store.eventBus.$emit(Bus.ERD.scroll);
                  this.store.tableStore.commit(
                    TableCommit.tableSort,
                    this.store
                  );
                }
              } catch (err) {
                const key =
                  ". Instead, I was expecting to see one of the following:";
                const startIndex = err.message.indexOf("\n");
                const lastIndex = err.message.indexOf(key);
                const message = err.message.substr(
                  startIndex,
                  lastIndex - startIndex
                );
                if (this.store) {
                  this.store.eventBus.$emit(
                    Bus.ERD.importErrorDDLStart,
                    message
                  );
                }
              }
            }
            this.importInputSQL.value = "";
          };
        } else {
          alert("Just upload the sql file");
        }
      }
    });
  }

  public importJSON(store: StoreManagement) {
    this.store = store;
    this.importInputJSON.click();
  }

  public importSQL(store: StoreManagement, database: Database) {
    this.store = store;
    this.currentDatabase = database;
    this.importInputSQL.click();
  }

  public exportPNG(id: string, databaseName: string) {
    const canvas = document.getElementById(id);
    if (canvas) {
      canvas.style.backgroundColor = "#282828";
      domToImage
        .toBlob(canvas)
        .then(blob => {
          let fileName = `unnamed-${new Date().getTime()}.png`;
          if (databaseName.trim() !== "") {
            fileName = `${databaseName}-${new Date().getTime()}.png`;
          }
          this.executeExport(blob, fileName);
        })
        .finally(() => {
          canvas.style.backgroundColor = null;
        });
    }
  }

  public exportJSON(json: string, databaseName: string) {
    let fileName = `unnamed-${new Date().getTime()}.vuerd.json`;
    if (databaseName.trim() !== "") {
      fileName = `${databaseName}-${new Date().getTime()}.vuerd.json`;
    }
    const blobJson = new Blob([json], { type: "application/json" });
    this.executeExport(blobJson, fileName);
  }

  private executeExport(blob: Blob, fileName: string) {
    this.exportA.href = window.URL.createObjectURL(blob);
    this.exportA.download = fileName;
    this.exportA.click();
  }
}

export default new File();

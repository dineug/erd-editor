import domToImage from "dom-to-image";
import { Parser } from "sql-ddl-to-json-schema";
import { Store } from "./Store";
import { CanvasState, Database } from "./store/Canvas";
import { TableState } from "./store/Table";
import { MemoState } from "./store/Memo";
import { RelationshipState } from "./store/Relationship";
import { loadJson } from "./command/editor";
import { sortTable } from "./command/table";
import { EditorContext } from "./EditorContext";
import { createJson } from "./ParserSQLToJson";
import { Bus } from "./Event";

export interface JsonFormat {
  canvas: CanvasState;
  table: TableState;
  memo: MemoState;
  relationship: RelationshipState;
}

export function createJsonFormat(store: Store): JsonFormat {
  const { canvasState, tableState, memoState, relationshipState } = store;
  return {
    canvas: canvasState,
    table: tableState,
    memo: memoState,
    relationship: relationshipState,
  };
}

export function createJsonStringify(store: Store): string {
  return JSON.stringify(
    createJsonFormat(store),
    (key, value) => {
      if (key === "_show") {
        return undefined;
      }
      return value;
    },
    2
  );
}

export function exportPNG(
  root: Element | DocumentFragment,
  selector: string,
  name?: string
) {
  const el = root.querySelector(selector);
  if (el) {
    domToImage.toBlob(el).then((blob) => {
      executeExport(
        blob,
        name?.trim() === ""
          ? `unnamed-${new Date().getTime()}.png`
          : `${name}-${new Date().getTime()}.png`
      );
    });
  }
}

export function exportJSON(json: string, name?: string) {
  const blobJson = new Blob([json], { type: "application/json" });
  executeExport(
    blobJson,
    name?.trim() === ""
      ? `unnamed-${new Date().getTime()}.vuerd.json`
      : `${name}-${new Date().getTime()}.vuerd.json`
  );
}

function executeExport(blob: Blob, fileName: string) {
  const exportHelper = document.createElement("a");
  exportHelper.href = window.URL.createObjectURL(blob);
  exportHelper.download = fileName;
  exportHelper.click();
}

export function importJSON(store: Store) {
  const importHelperJSON = document.createElement("input");
  importHelperJSON.setAttribute("type", "file");
  importHelperJSON.setAttribute("accept", ".json");
  importHelperJSON.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const file = input.files[0];
      if (/\.(json)$/i.test(file.name)) {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
          const value = reader.result;
          if (typeof value === "string") {
            store.dispatch(loadJson(value));
          }
        };
      } else {
        alert("Just upload the json file");
      }
    }
  });
  importHelperJSON.click();
}

const parserMySQL = new Parser("mysql");
export function importSQL(context: EditorContext, database: Database) {
  const { store, helper, eventBus } = context;
  const importHelperSQL = document.createElement("input");
  importHelperSQL.setAttribute("type", "file");
  importHelperSQL.setAttribute("accept", ".sql");
  importHelperSQL.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const file = input.files[0];
      if (/\.(sql)$/i.test(file.name)) {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
          const value = reader.result;
          if (typeof value === "string") {
            try {
              const tables = parserMySQL.feed(value).toCompactJson();
              const json = createJson(tables, helper, database);
              store.dispatch(loadJson(json), sortTable());
            } catch (err) {
              eventBus.emit(Bus.Editor.importErrorDDL, {
                message: err.message,
              });
            }
          }
        };
      } else {
        alert("Just upload the sql file");
      }
    }
  });
  importHelperSQL.click();
}

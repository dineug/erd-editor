import domToImage from "dom-to-image";
import { Store } from "./Store";
import { CanvasState } from "./store/Canvas";
import { TableState } from "./store/Table";
import { MemoState } from "./store/Memo";
import { RelationshipState } from "./store/Relationship";
import { loadJson } from "./command/editor";
import { sortTable } from "./command/table";
import { EditorContext } from "./EditorContext";
import { Bus } from "./Event";
import { DDLParser } from "@dineug/sql-ddl-parser";
import { createJson } from "./SQLParserToJson";

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

export function createJsonStringify(store: Store, space?: number): string {
  return JSON.stringify(
    createJsonFormat(store),
    (key, value) => {
      if (key === "_show") {
        return undefined;
      }
      return value;
    },
    space
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

export function exportSQLDDL(sql: string, name?: string) {
  const blobSQL = new Blob([sql]);
  executeExport(
    blobSQL,
    name?.trim() === ""
      ? `unnamed-${new Date().getTime()}.sql`
      : `${name}-${new Date().getTime()}.sql`
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

export function importSQL(context: EditorContext) {
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
              const statements = DDLParser(value);
              const json = createJson(
                statements,
                helper,
                store.canvasState.database
              );
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

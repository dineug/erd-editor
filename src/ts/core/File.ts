import domToImage from "dom-to-image";
import { Store } from "@src/core/Store";
import { CanvasState } from "@src/core/store/Canvas";
import { TableState } from "@src/core/store/Table";
import { MemoState } from "@src/core/store/Memo";
import { RelationshipState } from "@src/core/store/Relationship";
import { loadJson } from "@src/core/command/editor";

export interface JsonFormat {
  canvas: CanvasState;
  table: TableState;
  memo: MemoState;
  relationship: RelationshipState;
}

export function jsonFormat(store: Store): JsonFormat {
  const { canvasState, tableState, memoState, relationshipState } = store;
  return {
    canvas: canvasState,
    table: tableState,
    memo: memoState,
    relationship: relationshipState,
  };
}

const exportHelper = document.createElement("a");

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

export function importSQL(store: Store) {
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
          if (value) {
            // TODO: data load
          }
        };
      } else {
        alert("Just upload the sql file");
      }
    }
  });
  importHelperSQL.click();
}

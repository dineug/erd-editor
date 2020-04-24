import domToImage from "dom-to-image";

const exportHelper = document.createElement("a");
const importHelperJSON = document.createElement("input");
const importHelperSQL = document.createElement("input");

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
        if (value) {
          // TODO: data load
        }
      };
    } else {
      alert("Just upload the json file");
    }
  }
});

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

export function importJSON() {
  importHelperJSON.click();
}

export function importSQL() {
  importHelperSQL.click();
}

import StoreManagement from "@/store/StoreManagement";
import domToImage from "dom-to-image";

class File {
  private exportA = document.createElement("a");
  private importInputJSON = document.createElement("input");
  private store: StoreManagement | null = null;

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
            }
            this.importInputJSON.value = "";
          };
        } else {
          alert("Just upload the json file");
        }
      }
    });
  }

  public importJSON(store: StoreManagement) {
    this.store = store;
    this.importInputJSON.click();
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

  public exportJson(json: string, databaseName: string) {
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

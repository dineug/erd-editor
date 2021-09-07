export interface ExportOptions {
  fileName: string;
  saveDirectly?: boolean;
}

export declare function setExportFileCallback(
  callback: (blob: Blob, options: ExportOptions) => void
): void;

export interface ImportOptions {
  accept: string;
}

export declare function setImportFileCallback(
  callback: (options: ImportOptions) => void
): void;

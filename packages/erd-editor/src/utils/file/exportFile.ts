import { toBlob } from 'html-to-image';
import { DateTime } from 'luxon';

type ExportOptions = {
  fileName: string;
};

type ExportFileCallback = (blob: Blob, options: ExportOptions) => void;

let performExportFileExtra: ExportFileCallback | null = null;

export function setExportFileCallback(callback: ExportFileCallback | null) {
  performExportFileExtra = callback;
}

function performExport(blob: Blob, options: ExportOptions) {
  const perform = performExportFileExtra
    ? performExportFileExtra
    : performExportBuiltin;

  perform(blob, options);
}

function performExportBuiltin(blob: Blob, options: ExportOptions) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = options.fileName;
  a.click();
}

function createName(suffix: string, name?: string) {
  const prefix = DateTime.now().toFormat(`yyyy-MM-dd'T'HH_mm_ss`);
  return name?.trim()
    ? `${name}-${prefix}${suffix}`
    : `unnamed-${prefix}${suffix}`;
}

export function exportJSON(json: string, name?: string) {
  performExport(new Blob([json], { type: 'application/json' }), {
    fileName: createName('.erd.json', name),
  });
}

export function exportSQLDDL(sql: string, name?: string) {
  performExport(new Blob([sql]), {
    fileName: createName('.sql', name),
  });
}

export function exportPNG(root: HTMLElement, name?: string) {
  toBlob(root).then(blob => {
    if (!blob) return;

    performExport(blob, {
      fileName: createName('.png', name),
    });
  });
}

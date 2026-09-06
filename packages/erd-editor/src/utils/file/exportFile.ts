import { DateTime } from 'luxon';

import {
  createDocumentPng,
  type DocumentPngOptions,
} from '@/services/export-png';

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

export function exportSchemaSQL(sql: string, name?: string) {
  performExport(new Blob([sql]), {
    fileName: createName('.sql', name),
  });
}

/**
 * Writes the whole document out as an image, at the zoom the author is reading
 * it at. The scene is rendered again off screen rather than captured, so the
 * file holds the whole document however far it was scrolled away from.
 *
 * @example
 * exportPNG({ doc: toJson(store.state), theme, toWidth, zoomLevel }, databaseName);
 */
export function exportPNG(
  options: DocumentPngOptions,
  name?: string
): Promise<void> {
  return createDocumentPng(options).then(blob => {
    performExport(blob, {
      fileName: createName('.png', name),
    });
  });
}

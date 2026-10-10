import {
  createDocumentPng,
  createDocumentSvg,
  type DocumentPngOptions,
  type DocumentSvgOptions,
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

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/** The local time to the second, as 2024-03-09T04_05_06, which sorts as it reads. */
function formatTimestamp(date: Date) {
  const day = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}_${pad(date.getMinutes())}_${pad(date.getSeconds())}`;
  return `${day}T${time}`;
}

function createName(suffix: string, name?: string) {
  const prefix = formatTimestamp(new Date());
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

/** The Code Generator's text, named as the other exports are, with its language's extension. */
export function exportCode(code: string, extension: string, name?: string) {
  performExport(new Blob([code]), {
    fileName: createName(extension, name),
  });
}

/**
 * Writes the whole document out as an image, at 100% whatever zoom the author
 * is reading it at. The scene is rendered again off screen rather than captured,
 * so the file holds the whole document however far it was scrolled away from.
 *
 * @example
 * exportPNG({ doc: toJson(store.state), theme, toWidth }, databaseName);
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

/**
 * Writes the whole document out as an svg, at 100% and with no scale, drawn
 * again off screen the way the png is.
 *
 * @example
 * exportSVG({ doc: toJson(store.state), theme, toWidth }, databaseName);
 */
export function exportSVG(
  options: DocumentSvgOptions,
  name?: string
): Promise<void> {
  return createDocumentSvg(options).then(svg => {
    performExport(new Blob([svg], { type: 'image/svg+xml' }), {
      fileName: createName('.svg', name),
    });
  });
}

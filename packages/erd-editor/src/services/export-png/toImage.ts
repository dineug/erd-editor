import { parser } from '@dineug/erd-editor-schema';
import { isString } from 'es-toolkit';

import { toLoadValue } from '@/utils/loadValue';
import { createText } from '@/utils/text';

import { assertExportOption } from './exportOptions';
import { createPresetExportTheme } from './exportTheme';
import { createDocumentPng, createDocumentSvg } from './index';

/** The Export image dialog's options, which open as the dialog does but light. */
export type ToImageOptions = {
  format: 'png' | 'svg';
  /** Whether the canvas colour is painted behind the diagram; on by default, off leaves it transparent. */
  background?: boolean;
  /** Whether the diagram is drawn dark; off by default, so every machine draws a document alike. */
  darkMode?: boolean;
  /** The png's pixels per scene unit, 2 by default; an svg, sized by its box alone, takes none. */
  scale?: 1 | 2 | 3;
};

const SCALES: ReadonlyArray<unknown> = [1, 2, 3];

const DEFAULT_SCALE = 2;

/**
 * Draws a document as a png or an svg, with the Export image dialog's options
 * and at 100% whatever zoom it was saved with, as the dialog does. It needs a
 * browser, and rejects text the parser cannot read or a value the dialog lacks.
 *
 * @example
 * const png = await toImage(value, { format: 'png', darkMode: true, scale: 3 });
 * const svg = await toImage(value, { format: 'svg', background: false });
 */
export function toImage(
  value: string,
  options: ToImageOptions & { format: 'png' }
): Promise<Blob>;
export function toImage(
  value: string,
  options: ToImageOptions & { format: 'svg' }
): Promise<string>;
export function toImage(
  value: string,
  options: ToImageOptions
): Promise<Blob | string>;
export async function toImage(
  value: string,
  {
    format,
    background = true,
    darkMode = false,
    scale = DEFAULT_SCALE,
  }: ToImageOptions
): Promise<Blob | string> {
  if (typeof document === 'undefined') {
    throw new Error('toImage needs a browser, since it draws on a canvas');
  }
  if (!isString(value)) {
    throw new TypeError("toImage: value is a document's JSON text");
  }
  assertExportOption(
    'toImage',
    format === 'png' || format === 'svg',
    'format',
    format
  );
  assertExportOption(
    'toImage',
    typeof background === 'boolean',
    'background',
    background
  );
  assertExportOption(
    'toImage',
    typeof darkMode === 'boolean',
    'darkMode',
    darkMode
  );
  assertExportOption('toImage', SCALES.includes(scale), 'scale', scale);

  const doc = toLoadValue(value);
  // Thrown here, before anything is drawn, for text the parser cannot read.
  parser(doc);

  const request = {
    doc,
    theme: createPresetExportTheme({ darkMode, background }),
    toWidth: createText().toWidth,
  };

  return format === 'png'
    ? createDocumentPng({ ...request, pixelRatio: scale })
    : createDocumentSvg(request);
}

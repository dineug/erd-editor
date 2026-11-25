import { parser } from '@dineug/erd-editor-schema';
import { isString } from 'es-toolkit';

import { toLoadValue } from '@/utils/loadValue';

import { assertExportOption } from './exportOptions';
import { createPresetExportTheme } from './exportTheme';
import { hasForeignDocument, installNodeRealm } from './nodeRealm';
import { tableToWidth } from './nodeTextWidth';

/** The Export image dialog's two switches that an svg reads, opening as toImage's do. */
export type ToSvgOptions = {
  /** Whether the canvas colour is painted behind the diagram; on by default, off leaves it transparent. */
  background?: boolean;
  /** Whether the diagram is drawn dark; off by default, so every machine draws a document alike. */
  darkMode?: boolean;
};

/**
 * The drawing the next call waits for. Every scene in the realm shares the
 * connector routes' sort, and a sort in one drawing retires the routes another
 * reads its box from, so two drawn at once come out in boxes too large.
 */
let lastDrawing: Promise<unknown> | undefined;

/**
 * Draws a document as an svg where there is no document, in Node say, at 100%
 * and in toImage's preset, measuring text off a width table rather than a font
 * engine. A page draws with toImage instead; this one refuses a realm that has a document.
 *
 * @example
 * const svg = await toSvg(value, { darkMode: true });
 */
export async function toSvg(
  value: string,
  { background = true, darkMode = false }: ToSvgOptions = {}
): Promise<string> {
  if (hasForeignDocument()) {
    throw new Error(
      'toSvg draws where there is no document; a page draws an svg with toImage'
    );
  }
  if (!isString(value)) {
    throw new TypeError("toSvg: value is a document's JSON text");
  }
  assertExportOption(
    'toSvg',
    typeof background === 'boolean',
    'background',
    background
  );
  assertExportOption(
    'toSvg',
    typeof darkMode === 'boolean',
    'darkMode',
    darkMode
  );

  const doc = toLoadValue(value);
  // Thrown here, before anything is drawn, for text the parser cannot read.
  parser(doc);

  // The scene's modules read a document as they load, so the realm comes first.
  installNodeRealm();
  const { renderDocumentSvg } = await import('./renderSvg');

  const svg = Promise.resolve(lastDrawing).then(() =>
    rejectingLoggedErrors(() =>
      renderDocumentSvg({
        doc,
        theme: createPresetExportTheme({ darkMode, background }),
        toWidth: tableToWidth,
      })
    )
  );
  lastDrawing = svg.catch(() => undefined);
  return svg;
}

/**
 * Runs a drawing and rejects with the first error r-html logged meanwhile: a
 * hook that throws is logged, one Error alone, never thrown, and the svg would
 * come out without what it draws. Every line still reaches the log.
 */
async function rejectingLoggedErrors(
  draw: () => Promise<string>
): Promise<string> {
  const log = console.error;
  const thrown: Error[] = [];
  console.error = (...args: unknown[]) => {
    if (args.length === 1 && args[0] instanceof Error) thrown.push(args[0]);
    Reflect.apply(log, console, args);
  };

  try {
    const svg = await draw();
    const [first] = thrown;
    if (first) {
      throw new Error(`toSvg: the scene threw as it drew: ${first.message}`, {
        cause: first,
      });
    }
    return svg;
  } finally {
    console.error = log;
  }
}

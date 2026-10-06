import * as Comlink from 'comlink';

import type { Theme } from '@/themes/tokens';
import { withTimeout } from '@/utils/promise';
import { spawnExportPngWorker } from '@/workers/spawn';

import type { ExportPngService } from './exportPngService';
import {
  renderDocumentPng,
  type RenderPngRequest,
  type RenderPngResult,
  type ResolutionReduction,
} from './renderPng';
import { renderDocumentSvg } from './renderSvg';
import { measureFontProbe, type ToWidth } from './textWidth';

export type { ResolutionReduction };

/** Which thread drew the image, which is the one thing a Promise cannot say. */
export type ExportPngRealm = 'worker' | 'main';

/**
 * Where an export has got to. Started fires before any drawing begins, and
 * again naming the main thread if the worker it first named gave way; finished
 * fires once, and only after a blob exists.
 */
export type ExportPngProgress =
  | { phase: 'started'; realm: ExportPngRealm }
  | {
      phase: 'finished';
      realm: ExportPngRealm;
      width: number;
      height: number;
    };

export type DocumentPngOptions = {
  doc: string;
  theme: Theme;
  /**
   * How the editor measures a string. A realm that draws the document has to
   * reproduce this to the pixel, so it is passed to be compared against rather
   * than to be called across a boundary a function does not cross.
   */
  toWidth: ToWidth;
  /** Image pixels per scene unit: the scale a dialog picks, 1 when left out. */
  pixelRatio?: number;
  /**
   * Called once, after a file exists, when the pixels the scale asked for
   * outran what a canvas holds, with those and the pixels written. A caller
   * with somewhere to put it tells the author of a loss that is otherwise silent.
   */
  onResolutionReduced?: (reduction: ResolutionReduction) => void;
  /** Called as the export moves, for a caller that shows it is running. */
  onProgress?: (progress: ExportPngProgress) => void;
};

/**
 * One image pixel per scene unit, so the png is exactly the box the document
 * draws for every box a canvas can hold.
 */
const DEFAULT_PIXEL_RATIO = 1;

const WORKER_NAME = `@dineug/erd-editor-export-png-worker?v${__APP_VERSION__}`;

/**
 * How long a shared worker gets to answer its first call. One that throws
 * while evaluating fires error at the constructor that started it and at no
 * other: its port stays open, onconnect never runs, and a call waits for ever.
 */
const HANDSHAKE_MS = 10_000;

type Remote = Comlink.Remote<ExportPngService>;

let connection: Promise<Remote | null> | null = null;

/**
 * The shared worker, or null on a host that will not run one. The handshake is
 * what separates the two, because a constructor that returns is no evidence
 * the script behind it ran.
 */
function connectSharedWorker(): Promise<Remote | null> {
  if (connection) return connection;

  connection = (async () => {
    let worker: SharedWorker;

    try {
      worker = spawnExportPngWorker(WORKER_NAME);
    } catch (error) {
      console.warn('[export-png] this host built no shared worker', error);
      return null;
    }

    // A worker that dies later leaves its port open and every call after it
    // pending, so the connection is dropped and the next export reconnects.
    worker.onerror = () => {
      connection = null;
    };

    const remote = Comlink.wrap<ExportPngService>(worker.port);

    try {
      await withTimeout(
        remote.probeFontWidths(),
        HANDSHAKE_MS,
        '[export-png] the worker did not answer'
      );
      return remote;
    } catch (error) {
      console.warn('[export-png] the shared worker did not start', error);
      worker.port.close();
      return null;
    }
  })();

  return connection;
}

type Reporters = Pick<DocumentPngOptions, 'onResolutionReduced' | 'onProgress'>;

function report(
  { blob, width, height, reduction }: RenderPngResult,
  realm: ExportPngRealm,
  { onResolutionReduced, onProgress }: Reporters
): Blob {
  if (reduction) onResolutionReduced?.(reduction);
  onProgress?.({ phase: 'finished', realm, width, height });

  return blob;
}

/** The two ways one drawing can be made: across the worker's port, or here. */
type Drawing<T> = {
  inWorker: (remote: Remote, fontProbe: number[]) => Promise<T>;
  onMain: () => Promise<T>;
};

/**
 * Makes a drawing in the shared worker, or on this thread when the worker is
 * missing or hands it back. Both realms take the same request, which carries
 * nothing but what survives a structured clone.
 */
async function drawInRealm<T>(
  { inWorker, onMain }: Drawing<T>,
  toWidth: ToWidth,
  onProgress?: DocumentPngOptions['onProgress']
): Promise<{ result: T; realm: ExportPngRealm }> {
  // A face still loading measures differently from the one the document was
  // laid out with, and the image keeps whichever was in place when it was drawn.
  await document.fonts?.ready;

  if (typeof SharedWorker !== 'undefined') {
    // Announced before the handshake rather than after it, because the first
    // export of a session pays for the worker's whole module graph here and a
    // caller showing that the export is running wants to show it by then.
    onProgress?.({ phase: 'started', realm: 'worker' });
    const remote = await connectSharedWorker();

    if (remote) {
      try {
        const result = await inWorker(remote, measureFontProbe(toWidth));

        return { result, realm: 'worker' };
      } catch (error) {
        console.warn('[export-png] the worker handed the export back', error);
      }
    }
  }

  onProgress?.({ phase: 'started', realm: 'main' });
  const result = await onMain();

  return { result, realm: 'main' };
}

function renderInRealm(
  request: RenderPngRequest,
  toWidth: ToWidth,
  onProgress?: DocumentPngOptions['onProgress']
): Promise<{ result: RenderPngResult; realm: ExportPngRealm }> {
  return drawInRealm(
    {
      inWorker: (remote, fontProbe) => remote.render({ ...request, fontProbe }),
      onMain: () => renderDocumentPng({ ...request, toWidth }),
    },
    toWidth,
    onProgress
  );
}

/**
 * A png of everything the document draws, at 100% whatever zoom it is being
 * read at. The scene is drawn again from the document rather than read off the
 * screen, so the image holds the whole document however far it was scrolled away.
 *
 * @example
 * const blob = await createDocumentPng({ doc: toJson(store.state), theme, toWidth });
 */
export async function createDocumentPng({
  doc,
  theme,
  toWidth,
  pixelRatio = DEFAULT_PIXEL_RATIO,
  onResolutionReduced,
  onProgress,
}: DocumentPngOptions): Promise<Blob> {
  // Copied, not passed on: the editor hands out its palette as an observable
  // proxy, and a proxy is what structuredClone refuses, so a worker sent the
  // live object gets a DataCloneError instead of an image.
  const request = { doc, theme: { ...theme }, pixelRatio };
  const { result, realm } = await renderInRealm(request, toWidth, onProgress);

  return report(result, realm, { onResolutionReduced, onProgress });
}

export type DocumentPreviewOptions = Pick<
  DocumentPngOptions,
  'doc' | 'theme' | 'toWidth'
> & {
  /** The longest side the preview may take, in pixels. */
  maxSide: number;
};

/** A small png of the export, and the box the export itself is measured by. */
export type DocumentPreview = {
  blob: Blob;
  width: number;
  height: number;
  /** The box the export holds, in scene units, margin included. */
  documentWidth: number;
  documentHeight: number;
};

/**
 * The export drawn small, for a dialog to show before any file is written. It
 * takes the same path as the export, worker first, so the picture is the one
 * the file will hold, its scale capped at the side it is given.
 *
 * @example
 * const preview = await createDocumentPreview({ doc, theme, toWidth, maxSide: 960 });
 */
export async function createDocumentPreview({
  doc,
  theme,
  toWidth,
  maxSide,
}: DocumentPreviewOptions): Promise<DocumentPreview> {
  const request = {
    doc,
    theme: { ...theme },
    pixelRatio: DEFAULT_PIXEL_RATIO,
    maxSide,
  };
  const { result } = await renderInRealm(request, toWidth);

  return {
    blob: result.blob,
    width: result.width,
    height: result.height,
    documentWidth: result.documentWidth,
    documentHeight: result.documentHeight,
  };
}

export type DocumentSvgOptions = Pick<
  DocumentPngOptions,
  'doc' | 'theme' | 'toWidth'
>;

/**
 * An svg of everything the document draws, at 100% as the png is. It takes
 * the png's path, worker first, and leaves the scale out, since a vector is
 * sized by the box alone and holds no canvas ceiling to cut it.
 *
 * @example
 * const svg = await createDocumentSvg({ doc, theme, toWidth });
 */
export async function createDocumentSvg({
  doc,
  theme,
  toWidth,
}: DocumentSvgOptions): Promise<string> {
  // Copied for the reason the png copies it: a proxy does not clone.
  const request = { doc, theme: { ...theme } };
  const { result } = await drawInRealm(
    {
      inWorker: (remote, fontProbe) =>
        remote.renderSvg({ ...request, fontProbe }),
      onMain: () => renderDocumentSvg({ ...request, toWidth }),
    },
    toWidth
  );

  return result;
}

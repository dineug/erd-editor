import * as Comlink from 'comlink';

import type { Theme } from '@/themes/tokens';

import ExportPngSharedWorker from './exportPng.shared-worker?sharedworker&inline';
import type { ExportPngService } from './exportPngService';
import {
  renderDocumentPng,
  type RenderPngResult,
  type ResolutionReduction,
} from './renderPng';
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
  pixelRatio?: number;
  /**
   * Called once, after a file exists, when the box outran what a canvas holds
   * and the image had to be scaled down. A caller with somewhere to put it is
   * what turns a silent loss of resolution into something the author is told.
   */
  onResolutionReduced?: (reduction: ResolutionReduction) => void;
  /** Called as the export moves, for a caller that shows it is running. */
  onProgress?: (progress: ExportPngProgress) => void;
};

/**
 * One image pixel per canvas unit, so the png is exactly the canvas box for
 * every box a canvas can hold.
 */
const DEFAULT_PIXEL_RATIO = 1;

const WORKER_NAME = `@dineug/erd-editor-export-png-worker?v${__APP_VERSION__}`;

/**
 * How long a shared worker gets to answer its first call. A shared worker that
 * throws while evaluating reports it to the console and to nobody else: the
 * port stays open, onconnect never runs, and the call waits for ever.
 */
const HANDSHAKE_MS = 10_000;

type Remote = Comlink.Remote<ExportPngService>;

let connection: Promise<Remote | null> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('[export-png] the worker did not answer')),
      ms
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

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
      worker = new ExportPngSharedWorker({ name: WORKER_NAME });
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
      await withTimeout(remote.probeFontWidths(), HANDSHAKE_MS);
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

/**
 * A png of the whole canvas box, whatever the editor is scrolled or zoomed to.
 * The scene is drawn again from the document rather than read off the screen,
 * which is what makes the image the same however the editor is being viewed.
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
  // A face still loading measures differently from the one the document was
  // laid out with, and the image keeps whichever was in place when it was drawn.
  await document.fonts?.ready;

  // Copied, not passed on: the editor hands out its palette as an observable
  // proxy, and a proxy is what structuredClone refuses, so a worker sent the
  // live object gets a DataCloneError instead of an image.
  const request = { doc, theme: { ...theme }, pixelRatio };
  const reporters = { onResolutionReduced, onProgress };

  if (typeof SharedWorker !== 'undefined') {
    // Announced before the handshake rather than after it, because the first
    // export of a session pays for the worker's whole module graph here and a
    // caller showing that the export is running wants to show it by then.
    onProgress?.({ phase: 'started', realm: 'worker' });
    const remote = await connectSharedWorker();

    if (remote) {
      try {
        const fontProbe = measureFontProbe(toWidth);
        const result = await remote.render({ ...request, fontProbe });

        return report(result, 'worker', reporters);
      } catch (error) {
        console.warn('[export-png] the worker handed the export back', error);
      }
    }
  }

  onProgress?.({ phase: 'started', realm: 'main' });
  const result = await renderDocumentPng({ ...request, toWidth });

  return report(result, 'main', reporters);
}

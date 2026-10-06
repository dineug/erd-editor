import { DOMTemplateLiterals, html } from '@dineug/r-html';

import type { AppContext } from '@/components/appContext';
import { localized } from '@/components/localized/Localized';
import Toast from '@/components/primitives/toast/Toast';
import { openToastWhileRunning } from '@/components/toast-container/openToastWhileRunning';
import {
  createDocumentPng,
  type DocumentPngOptions,
  type ResolutionReduction,
} from '@/services/export-png';
import { copyImageToClipboard } from '@/utils/clipboard';
import { Emitter, openToastAction } from '@/utils/emitter';
import { exportPNG, exportSVG } from '@/utils/file/exportFile';

/** What an image is drawn from; each action hooks up the reporters itself. */
export type ImageRequest = Omit<
  DocumentPngOptions,
  'onResolutionReduced' | 'onProgress'
>;

/** What an svg is drawn from: the request less the scale, which a vector has no use for. */
export type SvgRequest = Omit<ImageRequest, 'pixelRatio'>;

type AskedPixels = Pick<ResolutionReduction, 'askedWidth' | 'askedHeight'>;

/** The image formats a file is written in, which no language translates. */
type ImageFormat = 'PNG' | 'SVG';

/**
 * The dialog's warning before any file exists: the pixels the zoom times the
 * scale asks for, which a canvas ceiling cuts. The toast after it opens alike.
 */
export function describeAskedSize({ askedWidth, askedHeight }: AskedPixels) {
  return localized('exportImage.reducedFrom', { askedWidth, askedHeight });
}

/**
 * Says what was lost and why, in the pixels the dialog warned of: what the zoom
 * times the scale asked for, then what was written. A box that fits at 1x can
 * still outrun a canvas at 2x, so the document's own size explains nothing.
 */
export function describeReduction({
  askedWidth,
  askedHeight,
  width,
  height,
}: ResolutionReduction) {
  return localized('exportImage.reducedFromTo', {
    askedWidth,
    askedHeight,
    width,
    height,
  });
}

function openToast(
  emitter: Emitter,
  title: DOMTemplateLiterals,
  description?: DOMTemplateLiterals
) {
  emitter.emit(
    openToastAction({
      message: html`<${Toast} title=${title} description=${description} />`,
    })
  );
}

/**
 * Waits out the work under a busy toast shown only while it runs long, and
 * settles once that toast is gone, to the work's error or to null.
 */
async function settleUnderBusyToast(
  emitter: Emitter,
  work: Promise<unknown>,
  description: DOMTemplateLiterals
): Promise<{ error: unknown } | null> {
  const outcome = work.then(
    () => null,
    (error: unknown) => ({ error })
  );

  await openToastWhileRunning(
    emitter,
    outcome,
    html`<${Toast} busy=${true} description=${description} />`
  );

  return outcome;
}

/**
 * Writes a file under the busy toast and reports a failure in its place,
 * answering whether the file was written. The busy toast goes first, so
 * whatever is said after it replaces it rather than piling on it.
 */
async function writeImageFile(
  emitter: Emitter,
  format: ImageFormat,
  writing: Promise<void>
): Promise<boolean> {
  const failure = await settleUnderBusyToast(
    emitter,
    writing,
    localized('exportImage.exporting', { format })
  );
  if (!failure) return true;

  console.error(
    `[export-${format.toLowerCase()}] the document could not be exported`,
    failure.error
  );
  openToast(
    emitter,
    localized('exportImage.exportFailed', { format }),
    localized('exportImage.seeConsole')
  );
  return false;
}

/**
 * Draws the document into a png file, saying so while it draws and reporting
 * afterwards. The two messages are sequenced rather than stacked, so what
 * became of the file replaces the message about making it.
 *
 * @example
 * await exportImagePng(app, { doc, theme, toWidth, zoomLevel, pixelRatio: 2 }, databaseName);
 */
export async function exportImagePng(
  { emitter }: AppContext,
  request: ImageRequest,
  databaseName: string
) {
  let reduction: ResolutionReduction | null = null;

  const written = await writeImageFile(
    emitter,
    'PNG',
    exportPNG(
      {
        ...request,
        // Held, not shown: the file does not exist yet, and this message belongs
        // after the one saying the editor is still drawing it.
        onResolutionReduced: value => {
          reduction = value;
        },
      },
      databaseName
    )
  );

  if (written && reduction) {
    openToast(
      emitter,
      localized('exportImage.exportedReduced'),
      describeReduction(reduction)
    );
  }
}

/**
 * Draws the document into an svg file at the zoom, the scale left out, saying
 * so while it draws. An svg holds no canvas, so nothing is ever reduced, and
 * only a failure is reported once the file is done.
 *
 * @example
 * await exportImageSvg(app, { doc, theme, toWidth, zoomLevel, i18n }, databaseName);
 */
export async function exportImageSvg(
  { emitter }: AppContext,
  { doc, theme, toWidth, zoomLevel, i18n }: SvgRequest,
  databaseName: string
) {
  await writeImageFile(
    emitter,
    'SVG',
    exportSVG({ doc, theme, toWidth, zoomLevel, i18n }, databaseName)
  );
}

/**
 * Puts the document on the clipboard as a png. The clipboard write starts in
 * the click that called this, before any await, so call it from the handler
 * itself; a host that refuses is told to save a PNG instead.
 *
 * @example
 * copyImagePng(app, { doc, theme, toWidth, zoomLevel, pixelRatio: 2 });
 */
export async function copyImagePng(
  { emitter }: AppContext,
  request: ImageRequest
) {
  let reduction: ResolutionReduction | null = null;
  let renderError: unknown = null;

  const copying = copyImageToClipboard(() =>
    createDocumentPng({
      ...request,
      onResolutionReduced: value => {
        reduction = value;
      },
    }).catch((error: unknown) => {
      // The clipboard reports a failed image as its own refusal, which says
      // nothing of why the drawing failed, so the cause is kept for the log.
      renderError = error;
      throw error;
    })
  );
  const failure = await settleUnderBusyToast(
    emitter,
    copying,
    localized('exportImage.copying')
  );

  if (failure) {
    console.error(
      '[export-png] the image could not be copied',
      renderError ?? failure.error
    );
    openToast(
      emitter,
      localized('exportImage.copyFailed'),
      localized('exportImage.saveAsPng')
    );
    return;
  }

  if (reduction) {
    openToast(
      emitter,
      localized('exportImage.copiedReduced'),
      describeReduction(reduction)
    );
    return;
  }

  openToast(emitter, localized('exportImage.copied'));
}

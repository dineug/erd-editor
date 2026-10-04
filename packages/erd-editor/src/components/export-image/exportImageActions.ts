import { html } from '@dineug/r-html';

import type { AppContext } from '@/components/appContext';
import Toast from '@/components/primitives/toast/Toast';
import { openToastWhileRunning } from '@/components/toast-container/openToastWhileRunning';
import {
  createDocumentPng,
  type DocumentPngOptions,
  type ResolutionReduction,
} from '@/services/export-png';
import { copyImageToClipboard } from '@/utils/clipboard';
import { Emitter, openToastAction } from '@/utils/emitter';
import { exportPNG } from '@/utils/file/exportFile';

/** What an image is drawn from; each action hooks up the reporters itself. */
export type ImageRequest = Omit<
  DocumentPngOptions,
  'onResolutionReduced' | 'onProgress'
>;

type AskedPixels = Pick<ResolutionReduction, 'askedWidth' | 'askedHeight'>;

function reducedFrom({ askedWidth, askedHeight }: AskedPixels, written = '') {
  return `Reduced from ${askedWidth} × ${askedHeight} px${written}, past what a browser canvas can hold`;
}

/**
 * The dialog's warning before any file exists: the pixels the zoom times the
 * scale asks for, which a canvas ceiling cuts. The toast after it opens alike.
 */
export function describeAskedSize(size: AskedPixels) {
  return reducedFrom(size);
}

/**
 * Says what was lost and why, in the pixels the dialog warned of: what the zoom
 * times the scale asked for, then what was written. A box that fits at 1x can
 * still outrun a canvas at 2x, so the document's own size explains nothing.
 */
export function describeReduction(reduction: ResolutionReduction) {
  return reducedFrom(
    reduction,
    ` to ${reduction.width} × ${reduction.height} px`
  );
}

function openToast(emitter: Emitter, title: string, description?: string) {
  emitter.emit(
    openToastAction({
      message: html`<${Toast} title=${title} description=${description} />`,
    })
  );
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

  const outcome = exportPNG(
    {
      ...request,
      // Held, not shown: the file does not exist yet, and this message belongs
      // after the one saying the editor is still drawing it.
      onResolutionReduced: value => {
        reduction = value;
      },
    },
    databaseName
  ).then(
    () => null,
    (error: unknown) => ({ error })
  );

  await openToastWhileRunning(
    emitter,
    outcome,
    html`<${Toast} busy=${true} description=${'Exporting PNG…'} />`
  );

  const failure = await outcome;

  if (failure) {
    console.error(
      '[export-png] the document could not be exported',
      failure.error
    );
    openToast(
      emitter,
      "Couldn't export the PNG",
      'See the browser console for the error'
    );
    return;
  }

  if (reduction) {
    openToast(
      emitter,
      'Exported at a reduced resolution',
      describeReduction(reduction)
    );
  }
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

  const outcome = copyImageToClipboard(() =>
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
  ).then(
    () => null,
    (error: unknown) => ({ error })
  );

  await openToastWhileRunning(
    emitter,
    outcome,
    html`<${Toast} busy=${true} description=${'Copying image…'} />`
  );

  const failure = await outcome;

  if (failure) {
    console.error(
      '[export-png] the image could not be copied',
      renderError ?? failure.error
    );
    openToast(emitter, "Couldn't copy the image", 'Save it as a PNG instead');
    return;
  }

  if (reduction) {
    openToast(
      emitter,
      'Copied at a reduced resolution',
      describeReduction(reduction)
    );
    return;
  }

  openToast(emitter, 'Copied the image to the clipboard');
}

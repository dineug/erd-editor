import { DOMTemplateLiterals } from '@dineug/r-html';

import { localized } from '@/components/localized/Localized';
import Toast, { type ToastTone } from '@/components/primitives/toast/Toast';
import { Emitter, openToastAction } from '@/utils/emitter';
import { delay } from '@/utils/promise';

export type StatusToast = {
  /** Names the report and the values it shows, so only the same one replaces it. */
  key: string;
  title: DOMTemplateLiterals;
  description?: DOMTemplateLiterals;
  tone?: ToastTone;
  close?: Promise<void>;
};

/** How long a copy that worked is reported, short since nothing is left to do. */
const COPIED_FOR = 2000;

/**
 * Reports how something ended: its one line as the title, a second line as the
 * description, and a tone's mark when it was done or not done. Opened again
 * under its key, it takes the place of the one still up rather than piling on.
 *
 * @example
 * openStatusToast(emitter, { key: 'common.toast.noTablesToPlace', title: localized('common.toast.noTablesToPlace') });
 */
export function openStatusToast(
  emitter: Emitter,
  { key, title, description, tone, close }: StatusToast
) {
  emitter.emit(
    openToastAction({
      key,
      close,
      message: <Toast tone={tone} title={title} description={description} />,
    })
  );
}

/**
 * Says whether text reached the clipboard, a refusal as plainly as a copy, under
 * one key so a press repeated shows one toast.
 *
 * @example
 * reportCopy(emitter, copyToClipboard(state.sql));
 */
export function reportCopy(emitter: Emitter, copying: Promise<unknown>) {
  return copying.then(
    () =>
      openStatusToast(emitter, {
        key: 'copy',
        tone: 'success',
        title: localized('common.toast.copied'),
        close: delay(COPIED_FOR),
      }),
    () =>
      openStatusToast(emitter, {
        key: 'copy',
        tone: 'error',
        title: localized('common.toast.copyFailed'),
      })
  );
}

import { FC } from '@dineug/r-html';
import type { Subscription } from 'rxjs';

import { AppContext } from '@/components/appContext';
import Button from '@/components/primitives/button/Button';
import Toast from '@/components/primitives/toast/Toast';
import {
  createElkLayout,
  type ElkLayoutPoint,
  type ElkLayoutRequest,
} from '@/services/elk-layout';
import { openToastAction } from '@/utils/emitter';
import { KeyBindingName } from '@/utils/keyboard-shortcut';
import { closePromise } from '@/utils/promise';

type PlacingToastProps = {
  onCancel: () => void;
};

/**
 * The message up while ELK works, and the whole of what a one-shot placement
 * shows. There is no progress to follow and nothing to read off a layout that
 * does not exist yet, so Cancel is the only thing on it. A view placement shows it too.
 */
export const PlacingToast: FC<PlacingToastProps> = props => () => (
  <Toast
    busy={true}
    description="Placing tables…"
    action={<Button size="1" text="Cancel" onClick={props.onCancel} />}
  />
);

/** How a layout ended: placed, given up on by whoever waited, or never answered. */
export type ElkLayoutAnswer =
  | { status: 'placed'; points: ElkLayoutPoint[] }
  | { status: 'cancelled' }
  | { status: 'failed'; error: unknown };

export type LayoutByElkOptions = {
  /**
   * Whether the toast waits until the layout has run long enough to say so,
   * for a placement nobody asked to watch, rather than going up at once.
   */
  whenSlow?: boolean;
  /** Ends the wait from outside, as Cancel does, and takes the toast down. */
  signal?: AbortSignal;
};

/**
 * One ELK layout behind the Placing toast, reading nothing but the request and
 * the app context, so the document and a document not loaded yet are placed
 * alike. Cancel and the stop key end the wait at once, the toast with it.
 *
 * @example
 * const answer = await layoutByElk(app, request, { whenSlow: true });
 */
export function layoutByElk(
  { emitter, shortcut$ }: AppContext,
  request: ElkLayoutRequest,
  { whenSlow = false, signal }: LayoutByElkOptions = {}
): Promise<ElkLayoutAnswer> {
  return new Promise(resolve => {
    const [close, onClose] = closePromise();
    let settled = false;
    let subscription: Subscription | null = null;

    // The toast is taken down before the answer is handed over, so a failure
    // the caller reports does not read as two messages at once.
    const settle = (answer: ElkLayoutAnswer) => {
      if (settled) return;

      settled = true;
      subscription?.unsubscribe();
      signal?.removeEventListener('abort', cancel);
      onClose();
      resolve(answer);
    };

    function cancel() {
      settle({ status: 'cancelled' });
    }

    // The stop key is the toast's Cancel, so it ends nothing before the
    // toast is up to say what it would end.
    const openToast = () => {
      if (settled) return;

      subscription = shortcut$.subscribe(({ type }) => {
        type === KeyBindingName.stop && cancel();
      });
      emitter.emit(
        openToastAction({ close, message: <PlacingToast onCancel={cancel} /> })
      );
    };

    if (signal?.aborted) {
      cancel();
      return;
    }

    signal?.addEventListener('abort', cancel);
    whenSlow || openToast();

    createElkLayout(request, whenSlow ? openToast : undefined).then(
      points => settle({ status: 'placed', points }),
      error => settle({ status: 'failed', error })
    );
  });
}

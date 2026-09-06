import { FC } from '@dineug/r-html';

import { AppContext } from '@/components/appContext';
import Button from '@/components/primitives/button/Button';
import Toast from '@/components/primitives/toast/Toast';
import {
  createElkLayout,
  createElkLayoutRequest,
  type ElkLayoutPoint,
  type ElkPlacement,
  toTablePoints,
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
 * does not exist yet, so Cancel is the only thing on it.
 */
const PlacingToast: FC<PlacingToastProps> = props => () => (
  <Toast
    busy={true}
    description="Placing tables…"
    action={<Button size="1" text="Cancel" onClick={props.onCancel} />}
  />
);

/**
 * Places every table by ELK and hands the layout straight over. No preview
 * overlay: one layout arrives at once, there is nothing to weigh before it
 * lands, and a single undo puts every table back.
 *
 * @example
 * runElkPlacement(app.value, placement, handleChangeAutomaticTablePlacement);
 */
export async function runElkPlacement(
  app: AppContext,
  placement: ElkPlacement,
  onChange: (tables: ElkLayoutPoint[]) => void
): Promise<void> {
  const { store, emitter, shortcut$ } = app;
  const request = createElkLayoutRequest(store.state, placement);

  if (!request.nodes.length) {
    emitter.emit(
      openToastAction({ message: <Toast description="No tables to place" /> })
    );
    return;
  }

  const [close, onClose] = closePromise();
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };
  const subscription = shortcut$.subscribe(({ type }) => {
    type === KeyBindingName.stop && cancel();
  });
  // The toast is taken down before anything else is said, so a failure does
  // not read as two messages at once.
  const finish = () => {
    subscription.unsubscribe();
    onClose();
  };

  emitter.emit(
    openToastAction({ close, message: <PlacingToast onCancel={cancel} /> })
  );

  try {
    const points = await createElkLayout(request);
    finish();
    // A large schema can outlast the patience of whoever asked for it, and a
    // layout nobody is waiting for any more is dropped rather than applied.
    if (cancelled) return;

    onChange(toTablePoints(store.state, request, points));
  } catch (error) {
    finish();
    console.warn('[automatic-table-placement] no layout came back', error);
    if (cancelled) return;

    emitter.emit(
      openToastAction({
        message: <Toast description="Could not place tables" />,
      })
    );
  }
}

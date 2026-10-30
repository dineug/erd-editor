import { AnyAction } from '@dineug/r-html';
import { Observable } from 'rxjs';

import { ScreenSettingActionTypes } from '@/engine/actions';
import {
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  isRemoteWrite,
  isScreenWrite,
} from '@/engine/modules/settings/screenBaseline';
import { RootState } from '@/engine/state';
import { attachActionsTag, attachActionTag, Tag } from '@/engine/tag';
import { arrayHas } from '@/utils/arrayHas';

const hasScreenSetting = arrayHas<string>(ScreenSettingActionTypes);

const hasViewportWrite = arrayHas<string>([
  scrollToAction.type,
  streamScrollToAction.type,
  changeZoomLevelAction.type,
  streamZoomLevelAction.type,
]);

/** Whether the reader's own store wrote it, rather than a peer, a follow or a screen turn. */
const isLocal = ({ tags }: AnyAction): boolean =>
  !isRemoteWrite(tags) && !isScreenWrite(tags);

const tagScreen = (action: AnyAction): AnyAction =>
  hasScreenSetting(action.type) && !isRemoteWrite(action.tags)
    ? attachActionTag(Tag.screen, action)
    : action;

/**
 * The first writable placement after a readonly screen or a rejoin that kept
 * the screen moved the viewport is led by where the screen stands, absolute with
 * no undo entry, so a replica and a peer that never heard it pan from there.
 */
export function alignViewport(
  actions: Array<AnyAction>,
  state: RootState
): Array<AnyAction> {
  if (!state.editor.screenBaseline?.viewport) return actions;

  const index = actions.findIndex(
    action => hasViewportWrite(action.type) && isLocal(action)
  );
  if (index === -1) return actions;

  const { originX, originY, zoomLevel } = state.settings;
  const { version } = actions[index];
  const aligned = attachActionsTag(Tag.changeOnly, [
    { ...scrollToAction({ originX, originY }), version },
    { ...changeZoomLevelAction({ value: zoomLevel }), version },
  ]);
  return [...actions.slice(0, index), ...aligned, ...actions.slice(index)];
}

/**
 * Tags each setting a readonly reader turns as its own screen's (Tag.screen),
 * a peer's and a follow left as they are. Pure by contract, as
 * viewActionRedirect is: it maps the same batch and state to equal output.
 */
export const readonlyScreenTag = (
  getReadonly: () => boolean,
  getState: () => RootState
) => {
  return (source$: Observable<Array<AnyAction>>) =>
    new Observable<Array<AnyAction>>(subscriber =>
      source$.subscribe({
        next: actions => {
          subscriber.next(
            getReadonly()
              ? actions.map(tagScreen)
              : alignViewport(actions, getState())
          );
        },
        error: err => subscriber.error(err),
        complete: () => subscriber.complete(),
      })
    );
};

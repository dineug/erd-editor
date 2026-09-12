import { AnyAction } from '@dineug/r-html';
import { isNil } from 'es-toolkit';
import { Observable } from 'rxjs';

import { ActionType as EditorActionType } from '@/engine/modules/editor/actions';
import { SceneView } from '@/engine/modules/editor/state';
import { ActionType as SettingsActionType } from '@/engine/modules/settings/actions';
import { Tag } from '@/engine/tag';
import { bHas } from '@/utils/bit';

/** The four document placements a view takes over, each with the payload it already carries. */
const REDIRECT: Readonly<Record<string, string>> = {
  [SettingsActionType.scrollTo]: EditorActionType.viewScrollTo,
  [SettingsActionType.streamScrollTo]: EditorActionType.viewStreamScrollTo,
  [SettingsActionType.changeZoomLevel]: EditorActionType.viewChangeZoomLevel,
  [SettingsActionType.streamZoomLevel]: EditorActionType.viewStreamZoomLevel,
};

/** A peer's placement and a follow of one belong to the document however the reader stands. */
const isRemote = ({ tags }: AnyAction): boolean =>
  !isNil(tags) && (bHas(tags, Tag.shared) || bHas(tags, Tag.following));

const redirect = (action: AnyAction): AnyAction => {
  const type = REDIRECT[action.type];
  return type && !isRemote(action) ? { ...action, type } : action;
};

/**
 * Turns a scroll or zoom into the view's own while a view is active. Pure by
 * contract: the chain it sits in is cold with two subscribers, so this runs
 * twice per emission and must map the same input to the same output untouched.
 */
export const viewActionRedirect = (getActiveView: () => SceneView | null) => {
  return (source$: Observable<Array<AnyAction>>) =>
    new Observable<Array<AnyAction>>(subscriber =>
      source$.subscribe({
        next: actions => {
          subscriber.next(getActiveView() ? actions.map(redirect) : actions);
        },
        error: err => subscriber.error(err),
        complete: () => subscriber.complete(),
      })
    );
};

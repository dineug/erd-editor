import { FC, onMounted, watch } from '@dineug/r-html';
import { debounceTime, filter, Observable } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import { layoutOf } from '@/components/erd-editor/viewportLayout';
import { Open } from '@/constants/open';
import { isEditingText } from '@/engine/modules/editor/state';
import { useUnmounted } from '@/hooks/useUnmounted';
import { toggleSearchAction } from '@/utils/emitter';
import { KeyBindingName } from '@/utils/keyboard-shortcut';
import { isTakenOver } from '@/utils/takeover';

import { isExplorerShown } from '../explorerCommands';
import {
  cancelPendingSearch,
  focusSearch,
  noteBatch,
  openSearch,
  searchIfStale,
} from '../explorerSearch';

/** How long the edits must pause before an edit of a searched text searches again. */
export const EDIT_SEARCH_DELAY = 100;

/**
 * What opens the Explorer's search and keeps it current, mounted beside the
 * panel whether it shows or not: the find chord, the openings that hand a
 * query or none, and the searches an edit asks for.
 */
const ExplorerController: FC = (_props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();

  /**
   * Opens the search, or brings the keyboard back to a search shown. A text
   * editor keeps the chord, as it keeps the palette's, and the palette gives
   * way to it. Under zen mode it shows the panel and leaves zen on.
   */
  const handleShortcut = () => {
    const { store, emitter } = app.value;
    const { editor } = store.state;
    if (isEditingText(editor) || isTakenOver(store.state)) return;

    if (editor.openMap[Open.search]) emitter.emit(toggleSearchAction());
    isExplorerShown(store) ? focusSearch(store) : openSearch(store, emitter);
  };

  onMounted(() => {
    const { store, shortcut$, emitter } = app.value;

    addUnsubscribe(
      shortcut$
        .pipe(filter(({ type }) => type === KeyBindingName.findReplace))
        .subscribe(handleShortcut),
      emitter.on({
        // The toolbar's, the palette row's and the context menu's hand no
        // query, and a search shown keeps its current match and its run.
        openFindReplace: ({ payload }) =>
          !payload && isExplorerShown(store)
            ? focusSearch(store)
            : openSearch(store, emitter, payload ?? undefined),
      }),
      new Observable<void>(subscriber =>
        store.subscribe(actions => {
          noteBatch(store, actions) && subscriber.next();
        })
      )
        .pipe(debounceTime(EDIT_SEARCH_DELAY))
        .subscribe(() => searchIfStale(store)),
      // The batch that shows the panel again searches what was edited while it
      // stood aside, so it never shows a list the document has left behind.
      watch(layoutOf(store)).subscribe(name => {
        name === 'reach' && searchIfStale(store);
      }),
      () => cancelPendingSearch(store)
    );
  });

  return () => null;
};

export default ExplorerController;

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

import {
  closeExplorer,
  isExplorerPressed,
  isExplorerShown,
} from '../explorerCommands';
import {
  cancelPendingSearch,
  focusSearch,
  hasSearchDialog,
  noteBatch,
  openSearch,
  searchIfStale,
} from '../explorerSearch';

/** How long the edits must pause before an edit of a searched text searches again. */
export const EDIT_SEARCH_DELAY = 100;

/**
 * What opens the Explorer's search and keeps it current, mounted beside the
 * panel whether it shows or not: the find chord, the palette row's and the
 * context menu's openings, and the searches an edit asks for.
 */
const ExplorerController: FC = (_props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();

  /**
   * Closes the panel the toolbar button shows pressed, as the button does, and
   * opens the search otherwise. The palette and the dialogs the search trades
   * for itself give way to it instead, and a text editor keeps it.
   */
  const handleShortcut = () => {
    const { store, emitter } = app.value;
    const { editor } = store.state;
    if (isEditingText(editor) || isTakenOver(store.state)) return;

    if (editor.openMap[Open.search]) {
      emitter.emit(toggleSearchAction());
    } else if (isExplorerPressed(store) && !hasSearchDialog(store)) {
      closeExplorer(store);
      return;
    }
    isExplorerShown(store) ? focusSearch(store) : openSearch(store, emitter);
  };

  onMounted(() => {
    const { store, shortcut$, emitter } = app.value;

    addUnsubscribe(
      shortcut$
        .pipe(filter(({ type }) => type === KeyBindingName.findReplace))
        .subscribe(handleShortcut),
      emitter.on({
        // The palette row's and the context menu's: a search shown keeps its
        // current match and its run, and takes the keyboard back.
        openFindReplace: () =>
          isExplorerShown(store)
            ? focusSearch(store)
            : openSearch(store, emitter),
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

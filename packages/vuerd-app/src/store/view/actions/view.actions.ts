import { useTreeStore } from '@/store/tree';
import { state, useViewStore, ViewNode } from '@/store/view';
import { tabGroups } from '@/store/view/helper';

export function viewFocusStart(view: ViewNode) {
  const [, viewActions] = useViewStore();
  state.focusView = view;
  if (state.previewTab && view.id !== state.previewTab.viewNode?.id) {
    viewActions.tabAddPreviewEnd();
  }
}

export function viewFocusEnd() {
  state.focusView = null;
  const views = tabGroups(state.root);
  views.length && viewFocusStart(views[0]);
}

export function viewExplorerFocusStart() {
  const [, treeActions] = useTreeStore();
  treeActions.focusin();
}

export function viewExplorerFocusEnd() {
  const [, treeActions] = useTreeStore();
  treeActions.focusout();
}

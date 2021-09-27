import { getData, getDataIndex, isData } from '@/helpers';
import { Bus, eventBus } from '@/helpers/eventBus.helper';
import { TreeNode } from '@/store/tree';
import { state, Tab, useViewStore, ViewNode } from '@/store/view';
import {
  addView,
  deleteByView,
  resetSize,
  tabGroups,
} from '@/store/view/helper';

export function tabClose({ view, tab }: { view: ViewNode; tab: Tab }) {
  const index = view.tabs.indexOf(tab);
  view.tabs.splice(index, 1);
  tabViewDelete({ view, tab });
}

export function tabActive({ view, tab }: { view: ViewNode; tab?: Tab }) {
  if (tab) {
    let oldTab = null;
    for (const target of view.tabs) {
      if (target.active) {
        oldTab = target;
        break;
      }
    }
    if (!oldTab || tab.id !== oldTab.id) {
      view.tabs.forEach((value: Tab) => (value.active = value.id === tab.id));
      eventBus.emit(Bus.EditorViewer.editorLoad, view.id);
    }
  } else {
    const targetTab = view.tabs[0];
    view.tabs.forEach(
      (value: Tab) => (value.active = value.id === targetTab.id)
    );
    eventBus.emit(Bus.EditorViewer.editorLoad, view.id);
  }
}

export function tabActiveAll() {
  const views = tabGroups(state.root);
  views.forEach((view: ViewNode) => {
    if (!view.tabs.some((tab: Tab) => tab.active)) {
      tabActive({ view });
    }
  });
}

export function tabViewDelete({ view, tab }: { view: ViewNode; tab?: Tab }) {
  if (view.tabs.length === 0) {
    deleteByView(view);
  } else if (tab && tab.active) {
    tabActive({ view });
  }
}

export function tabDraggableStart(tab: Tab) {
  state.draggableTab = tab;
}

export function tabDraggableEnd() {
  state.draggableTab = null;
}

export function tabMove({ view, tab }: { view: ViewNode; tab?: Tab }) {
  const [, viewActions] = useViewStore();
  if (!state.draggableTab) return;
  const currentTab = state.draggableTab;
  if (!currentTab.viewNode) return;

  if (tab && view.id === currentTab.viewNode.id && tab.id !== currentTab.id) {
    const currentIndex = view.tabs.indexOf(currentTab);
    const targetIndex = view.tabs.indexOf(tab);
    view.tabs.splice(currentIndex, 1);
    view.tabs.splice(targetIndex, 0, currentTab as Tab);
  } else if (
    tab &&
    view.id !== currentTab.viewNode.id &&
    isData(view.tabs, currentTab.id)
  ) {
    const currentIndex = currentTab.viewNode.tabs.indexOf(currentTab);
    const targetIndex = view.tabs.indexOf(tab);
    currentTab.viewNode.tabs.splice(currentIndex, 1);
    view.tabs.splice(targetIndex, 0, currentTab as Tab);
    tabViewDelete({ view: currentTab.viewNode, tab: currentTab as Tab });
  } else if (
    view.id !== currentTab.viewNode.id &&
    !isData(view.tabs, currentTab.id)
  ) {
    const currentIndex = currentTab.viewNode.tabs.indexOf(currentTab);
    const targetIndex = getDataIndex(view.tabs, currentTab.id);
    if (targetIndex) {
      currentTab.viewNode.tabs.splice(currentIndex, 1);
      view.tabs.splice(targetIndex, 1);
      view.tabs.splice(targetIndex, 0, currentTab as Tab);
    }
    tabViewDelete({ view: currentTab.viewNode, tab: currentTab as Tab });
  } else if (!tab) {
    const currentIndex = currentTab.viewNode.tabs.indexOf(currentTab);
    currentTab.viewNode.tabs.splice(currentIndex, 1);
    view.tabs.push(currentTab as Tab);
    tabViewDelete({ view: currentTab.viewNode, tab: currentTab as Tab });
  }
  tabActive({ view, tab: currentTab as Tab });
  state.draggableTab.viewNode = view;
  viewActions.viewFocusStart(view);
}

export function tabAdd(treeNode: TreeNode) {
  if (state.focusView) {
    if (isData(state.focusView.tabs, treeNode.id)) {
      state.focusView.tabs.push(new Tab(treeNode));
    }
    state.focusView.tabs.forEach(
      (tab: Tab) => (tab.active = tab.id === treeNode.id)
    );
  } else {
    state.root.children.push(addView(state.root, [new Tab(treeNode)]));
    resetSize(state.root);
  }
  tabAddPreviewEnd();
}

export function tabAddPreviewStart(treeNode: TreeNode) {
  if (state.focusView) {
    if (isData(state.focusView.tabs, treeNode.id)) {
      if (state.previewTab) {
        state.previewTab.setTreeNode(treeNode);
      } else {
        const tab = new Tab(treeNode);
        state.focusView.tabs.push(tab);
        tab.viewNode = state.focusView;
        state.previewTab = tab;
      }
    }
    state.focusView.tabs.forEach(
      (tab: Tab) => (tab.active = tab.id === treeNode.id)
    );
  } else {
    const tab = new Tab(treeNode);
    const view = addView(state.root, [tab]);
    state.root.children.push(view);
    tab.viewNode = view;
    state.previewTab = tab;
    resetSize(state.root);
  }
  if (state.previewTab) {
    eventBus.emit(Bus.EditorViewer.editorLoad, state.previewTab.viewNode?.id);
  } else if (state.focusView) {
    eventBus.emit(Bus.EditorViewer.editorLoad, state.focusView.id);
  }
}

export function tabAddPreviewEnd() {
  state.previewTab = null;
}

export function tabDelete(id: string) {
  const views = tabGroups(state.root);
  const targetTabs: Tab[] = [];
  views.forEach((view: ViewNode) => {
    const tab = getData(view.tabs, id);
    if (tab) {
      tab.viewNode = view;
      targetTabs.push(tab);
      view.tabs.splice(view.tabs.indexOf(tab), 1);
    }
  });
  targetTabs.forEach((tab: Tab) => {
    tabViewDelete({ view: tab.viewNode as ViewNode, tab });
  });
}

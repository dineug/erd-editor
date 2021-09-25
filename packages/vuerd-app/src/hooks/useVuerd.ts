import { ERDEditorElement } from 'vuerd';

import { Bus, eventBus } from '@/helpers/eventBus.helper';
import { TreeNode } from '@/store/tree';
import { Tab } from '@/store/view';

const cache: Record<string, ERDEditorElement> = {};

const isCache = (key: string) => !!cache[key];

const getKey = (tab: Tab) =>
  tab.viewNode ? `${tab.treeNode.id}-${tab.viewNode.id}` : `${tab.treeNode.id}`;

const createVuerd = (node: TreeNode) => {
  const erdEditor = document.createElement('erd-editor');
  erdEditor.automaticLayout = true;
  erdEditor.initLoadJson(node.value);
  erdEditor.addEventListener('change', (event: any) => {
    node.value = event.target.value;
    eventBus.emit(Bus.App.save);
  });
  return erdEditor;
};

export function useVuerd() {
  const getVuerd = (tab: Tab) => {
    const key = getKey(tab);
    if (isCache(key)) return cache[key];

    const erdEditor = createVuerd(tab.treeNode);
    cache[key] = erdEditor;

    return erdEditor;
  };

  return {
    getVuerd,
  };
}

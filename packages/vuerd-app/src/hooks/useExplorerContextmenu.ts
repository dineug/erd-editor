import { reactive } from 'vue';

import { useTreeStore } from '@/store/tree';
import { Menu } from '@@types/menu';

function createMenus(): Menu[] {
  const [treeState, treeActions] = useTreeStore();
  const menu: Menu[] = treeState.selectNodes.length
    ? [
        {
          name: 'Rename',
          execute: () => treeActions.startRename(),
          keymap: 'Enter',
        },
        {
          name: 'Delete',
          execute() {},
        },
      ]
    : [];

  return [
    {
      name: 'New File',
      execute: () => treeActions.newFile(),
    },
    {
      name: 'New Folder',
      execute: () => treeActions.newFolder(),
    },
    ...menu,
  ].map(menu => ({
    ...menu,
    options: {
      nameWidth: 90,
      keymapWidth: 50,
    },
  }));
}

export function useExplorerContextmenu() {
  const state = reactive({
    menus: null as Menu[] | null,
    contextmenuX: 0,
    contextmenuY: 0,
  });

  const onContextmenu = (event: MouseEvent) => {
    event.preventDefault();
    state.contextmenuX = event.clientX;
    state.contextmenuY = event.clientY;
    state.menus = createMenus();
  };

  const onCloseContextmenu = () => {
    state.menus = null;
  };

  return {
    contextmenuState: state,
    onContextmenu,
    onCloseContextmenu,
  };
}

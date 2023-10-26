import ContextMenuItem from './context-menu-item/ContextMenuItem';
import ContextMenuRoot from './context-menu-root/ContextMenuRoot';
import Menu from './menu/Menu';

type CompositionContextMenu = {
  Root: typeof ContextMenuRoot;
  Item: typeof ContextMenuItem;
  Menu: typeof Menu;
};

const ContextMenu: CompositionContextMenu = {
  Root: ContextMenuRoot,
  Item: ContextMenuItem,
  Menu,
};

export default ContextMenu;

import ContextMenuItem from './context-menu-item/ContextMenuItem';
import ContextMenuRoot from './context-menu-root/ContextMenuRoot';
import ContextMenuSeparator from './context-menu-separator/ContextMenuSeparator';
import Menu from './menu/Menu';

type CompositionContextMenu = {
  Root: typeof ContextMenuRoot;
  Item: typeof ContextMenuItem;
  Separator: typeof ContextMenuSeparator;
  Menu: typeof Menu;
};

const ContextMenu: CompositionContextMenu = {
  Root: ContextMenuRoot,
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Menu,
};

export default ContextMenu;

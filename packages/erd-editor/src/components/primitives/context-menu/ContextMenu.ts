import ContextMenuContent from './context-menu-content/ContextMenuContent';
import ContextMenuItem from './context-menu-item/ContextMenuItem';
import ContextMenuSub from './context-menu-sub/ContextMenuSub';
import ContextMenuSubContent from './context-menu-sub-content/ContextMenuSubContent';
import ContextMenuSubTrigger from './context-menu-sub-trigger/ContextMenuSubTrigger';
import Menu from './menu/Menu';

type CompositionContextMenu = {
  Content: typeof ContextMenuContent;
  Item: typeof ContextMenuItem;
  Sub: typeof ContextMenuSub;
  SubTrigger: typeof ContextMenuSubTrigger;
  SubContent: typeof ContextMenuSubContent;
  Menu: typeof Menu;
};

const ContextMenu: CompositionContextMenu = {
  Content: ContextMenuContent,
  Item: ContextMenuItem,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
  Menu,
};

export default ContextMenu;

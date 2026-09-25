import { Button, DropdownMenu, Flex, IconButton } from '@radix-ui/themes';
import { EllipsisVertical, SquarePen } from 'lucide-react';

import * as styles from './SidebarHeaderRow.styles';

interface SidebarHeaderRowProps {
  /** The ghost row button that starts a new entry, such as New schema. */
  addLabel: string;
  onAdd: () => void;
  /** The name of the menu trigger beside it. */
  menuLabel: string;
  /** The menu's DropdownMenu items. */
  menuItems: React.ReactNode;
}

const SidebarHeaderRow: React.FC<SidebarHeaderRowProps> = ({
  addLabel,
  onAdd,
  menuLabel,
  menuItems,
}) => (
  <Flex align="center" gap="1">
    <Button
      css={styles.addButton}
      size="2"
      variant="ghost"
      color="gray"
      highContrast
      onClick={onAdd}
    >
      <SquarePen size={16} />
      {addLabel}
    </Button>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <IconButton
          css={styles.menuButton}
          size="2"
          variant="ghost"
          color="gray"
          aria-label={menuLabel}
        >
          <EllipsisVertical size={16} />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">{menuItems}</DropdownMenu.Content>
    </DropdownMenu.Root>
  </Flex>
);

export default SidebarHeaderRow;

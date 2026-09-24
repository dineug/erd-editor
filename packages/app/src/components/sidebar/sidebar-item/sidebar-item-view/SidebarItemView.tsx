import {
  DropdownMenu,
  Flex,
  IconButton,
  Text,
  TextField,
} from '@radix-ui/themes';
import { isEmpty } from 'es-toolkit/compat';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  findSuccessorSchemaItem,
  focusSchemaItem,
  focusSiblingSchemaItem,
} from '@/components/sidebar/sidebar-item/sidebarItemFocus';

import * as styles from './SidebarItemView.styles';

interface SidebarItemViewBaseProps {
  name: string;
  selected: boolean;
  /** Whether Tab lands on this item; the arrow keys reach the others. */
  tabStop: boolean;
  /** The row's tooltip, dropped while the name is being edited. */
  title?: string;
  /** The name of the rename field. */
  inputLabel: string;
  inputPlaceholder: string;
  /** Menu items between Rename and the remove item. */
  menuItems?: React.ReactNode;
  /** What sits between the name and the menu trigger. */
  trailing?: React.ReactNode;
  onFocus: () => void;
  onSelect: () => void;
  /** Called with the trimmed name, and only when it changed. */
  onRename: (name: string) => void;
}

// Delete, Backspace and a red menu item after a separator, or none of them.
type SidebarItemViewRemoveProps =
  | { onRemove: () => void; removeLabel: string }
  | { onRemove?: undefined; removeLabel?: undefined };

type SidebarItemViewProps = SidebarItemViewBaseProps &
  SidebarItemViewRemoveProps;

const SidebarItemView: React.FC<SidebarItemViewProps> = ({
  name,
  selected,
  tabStop,
  title,
  inputLabel,
  inputPlaceholder,
  menuItems,
  trailing,
  onFocus,
  onSelect,
  onRename,
  onRemove,
  removeLabel,
}) => {
  const [value, setValue] = useState(name);
  const [isEditing, setIsEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editingRef = useRef(false);
  const refocusRef = useRef(false);

  const handleStartEditing = () => {
    setValue(name);
    setIsEditing(true);
    editingRef.current = true;
  };

  // The field leaves the page when editing ends, and a browser may report
  // that as one more blur; the ref keeps a cancelled rename from committing.
  const handleStopEditing = () => {
    if (!editingRef.current) return;
    editingRef.current = false;

    const trimmed = value.trim();
    const newName = isEmpty(trimmed) ? name : trimmed;
    if (newName !== name) {
      onRename(newName);
    }
    setIsEditing(false);
  };

  const handleCancelEditing = () => {
    editingRef.current = false;
    setIsEditing(false);
  };

  const handleEditingKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === 'Enter') {
      refocusRef.current = true;
      handleStopEditing();
    } else if (event.key === 'Escape') {
      refocusRef.current = true;
      handleCancelEditing();
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };

  const handleSelect = (event: React.MouseEvent<HTMLDivElement>) => {
    // React bubbles clicks out of portals, so a menu item or dialog of this row
    // would select it too, reopening an entry just removed.
    if (!event.currentTarget.contains(event.target as Node)) return;
    onSelect();
  };

  // The row leaves with its menu, and the menu hands focus back to a trigger
  // that is gone by then, so the next row takes it once the menu has closed.
  const handleMenuRemove = () => {
    const successor =
      selectRef.current && findSuccessorSchemaItem(selectRef.current);
    onRemove?.();
    window.setTimeout(() => successor?.focus());
  };

  // The menu traps focus while it is open, so the name field only gets it
  // once the menu closes, in place of the trigger.
  const handleMenuCloseAutoFocus = (event: Event) => {
    if (!editingRef.current) return;
    event.preventDefault();
    inputRef.current?.focus();
  };

  // Enter and Space need nothing here: the button clicks, and the row selects.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const current = event.currentTarget;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        focusSiblingSchemaItem(current, event.key === 'ArrowDown' ? 1 : -1);
        break;
      case 'Home':
      case 'End': {
        const list = current.closest('[data-schema-list]');
        if (!list) return;
        event.preventDefault();
        focusSchemaItem(list, event.key === 'Home' ? 0 : -1);
        break;
      }
      case 'F2':
        event.preventDefault();
        handleStartEditing();
        break;
      case 'Delete':
      case 'Backspace':
        if (!onRemove) return;
        event.preventDefault();
        findSuccessorSchemaItem(current)?.focus();
        onRemove();
        break;
    }
  };

  useEffect(() => {
    if (isEditing || !refocusRef.current) return;
    refocusRef.current = false;
    selectRef.current?.focus();
  }, [isEditing]);

  return (
    <Flex
      css={[!isEditing && styles.hover, styles.item]}
      align="center"
      title={isEditing ? undefined : title}
      data-selected={selected && !isEditing}
      data-open-menu={open}
      onClick={handleSelect}
    >
      {isEditing ? (
        <TextField.Root
          ref={inputRef}
          css={[styles.text, styles.input]}
          value={value}
          placeholder={inputPlaceholder}
          aria-label={inputLabel}
          autoFocus
          onChange={handleChange}
          onBlur={handleStopEditing}
          onKeyDown={handleEditingKeyDown}
        />
      ) : (
        <button
          ref={selectRef}
          css={styles.select}
          type="button"
          tabIndex={tabStop ? 0 : -1}
          aria-current={selected ? 'page' : undefined}
          data-schema-item
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          onDoubleClick={handleStartEditing}
        >
          <Text css={[styles.text, styles.ellipsis]} size="2">
            {name}
          </Text>
        </button>
      )}

      {trailing}

      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger>
          <IconButton
            css={styles.menuTrigger}
            className="item-menu"
            size="1"
            variant="ghost"
            color="gray"
            tabIndex={tabStop ? undefined : -1}
            aria-label={`Actions for ${name}`}
          >
            <Ellipsis size={16} />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content onCloseAutoFocus={handleMenuCloseAutoFocus}>
          <DropdownMenu.Item onClick={handleStartEditing}>
            <Pencil size={16} />
            Rename
          </DropdownMenu.Item>
          {menuItems}
          {onRemove ? (
            <>
              <DropdownMenu.Separator />
              <DropdownMenu.Item color="red" onClick={handleMenuRemove}>
                <Trash2 size={16} />
                {removeLabel}
              </DropdownMenu.Item>
            </>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Flex>
  );
};

export default SidebarItemView;

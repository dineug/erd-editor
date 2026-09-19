import {
  DropdownMenu,
  Flex,
  IconButton,
  Text,
  TextField,
} from '@radix-ui/themes';
import { isEmpty } from 'es-toolkit/compat';
import { useAtom } from 'jotai';
import { Copy, Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  useDuplicateSchemaEntity,
  useMoveSchemaEntityToTrash,
  useNow,
  useUpdateSchemaEntity,
} from '@/atoms/modules/schema';
import { selectedSchemaIdAtom } from '@/atoms/modules/sidebar';
import SidebarCollaborative from '@/components/sidebar/sidebar-item/sidebar-collaborative/SidebarCollaborative';
import {
  findSuccessorSchemaItem,
  focusSchemaItem,
  focusSiblingSchemaItem,
} from '@/components/sidebar/sidebar-item/sidebarItemFocus';
import { SchemaEntity } from '@/services/indexeddb/modules/schema';
import { formatRelativeTime } from '@/utils/schemaList';

import * as styles from './SidebarItem.styles';

interface SidebarItemProps {
  entity: Omit<SchemaEntity, 'value'>;
  /** Whether Tab lands on this item; the arrow keys reach the others. */
  tabStop: boolean;
  onFocus: (id: string) => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  entity,
  tabStop,
  onFocus,
}) => {
  const [name, setName] = useState(entity.name);
  const [isEditing, setIsEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const updateSchemaEntity = useUpdateSchemaEntity();
  const duplicateSchemaEntity = useDuplicateSchemaEntity();
  const moveSchemaEntityToTrash = useMoveSchemaEntityToTrash();
  const [schemaId, setSchemaId] = useAtom(selectedSchemaIdAtom);
  const selectRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editingRef = useRef(false);
  const refocusRef = useRef(false);
  const now = useNow();
  const selected = schemaId === entity.id;

  const handleStartEditing = () => {
    setName(entity.name);
    setIsEditing(true);
    editingRef.current = true;
  };

  // The field leaves the page when editing ends, and a browser may report
  // that as one more blur; the ref keeps a cancelled rename from committing.
  const handleStopEditing = () => {
    if (!editingRef.current) return;
    editingRef.current = false;

    const value = name.trim();
    const newValue = isEmpty(value) ? entity.name : value;
    if (newValue !== entity.name) {
      updateSchemaEntity({
        id: entity.id,
        entityValue: { name: newValue },
      });
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
    setName(event.target.value);
  };

  const handleSelect = (event: React.MouseEvent<HTMLDivElement>) => {
    // React bubbles clicks out of portals, so a menu item or dialog of this row
    // would select it too, reopening a schema just moved to the trash.
    if (!event.currentTarget.contains(event.target as Node)) return;
    setSchemaId(entity.id);
  };

  const handleMoveToTrash = (current: HTMLElement) => {
    findSuccessorSchemaItem(current)?.focus();
    moveSchemaEntityToTrash(entity.id);
  };

  // The row leaves with its menu, and the menu hands focus back to a trigger
  // that is gone by then, so the next row takes it once the menu has closed.
  const handleMenuMoveToTrash = () => {
    const successor =
      selectRef.current && findSuccessorSchemaItem(selectRef.current);
    moveSchemaEntityToTrash(entity.id);
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
        event.preventDefault();
        handleMoveToTrash(current);
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
      title={
        isEditing
          ? undefined
          : `Edited ${formatRelativeTime(entity.updateAt, now)}`
      }
      data-selected={selected && !isEditing}
      data-open-menu={open}
      onClick={handleSelect}
    >
      {isEditing ? (
        <TextField.Root
          ref={inputRef}
          css={[styles.text, styles.input]}
          value={name}
          placeholder="schema name"
          aria-label="Schema name"
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
          onFocus={() => onFocus(entity.id)}
          onDoubleClick={handleStartEditing}
        >
          <Text css={[styles.text, styles.ellipsis]} size="2">
            {entity.name}
          </Text>
        </button>
      )}

      <SidebarCollaborative entity={entity} tabStop={tabStop} />

      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger>
          <IconButton
            css={styles.menuTrigger}
            className="item-menu"
            size="1"
            variant="ghost"
            color="gray"
            tabIndex={tabStop ? undefined : -1}
            aria-label={`Actions for ${entity.name}`}
          >
            <Ellipsis size={16} />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content onCloseAutoFocus={handleMenuCloseAutoFocus}>
          <DropdownMenu.Item onClick={handleStartEditing}>
            <Pencil size={16} />
            Rename
          </DropdownMenu.Item>
          <DropdownMenu.Item onClick={() => duplicateSchemaEntity(entity.id)}>
            <Copy size={16} />
            Duplicate
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item color="red" onClick={handleMenuMoveToTrash}>
            <Trash2 size={16} />
            Move to trash
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Flex>
  );
};

export default SidebarItem;

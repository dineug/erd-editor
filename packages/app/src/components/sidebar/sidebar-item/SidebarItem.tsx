import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { DropdownMenu, Flex, Text, TextField } from '@radix-ui/themes';
import { isEmpty } from 'es-toolkit/compat';
import { useAtom } from 'jotai';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  useDuplicateSchemaEntity,
  useMoveSchemaEntityToTrash,
  useNow,
  useUpdateSchemaEntity,
} from '@/atoms/modules/schema';
import { selectedSchemaIdAtom } from '@/atoms/modules/sidebar';
import SidebarCollaborative from '@/components/sidebar/sidebar-item/sidebar-collaborative/SidebarCollaborative';
import { SchemaEntity } from '@/services/indexeddb/modules/schema';
import { formatRelativeTime } from '@/utils/schemaList';

import * as styles from './SidebarItem.styles';

interface SidebarItemProps {
  entity: Omit<SchemaEntity, 'value'>;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ entity }) => {
  const [name, setName] = useState(entity.name);
  const [isEditing, setIsEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const updateSchemaEntity = useUpdateSchemaEntity();
  const duplicateSchemaEntity = useDuplicateSchemaEntity();
  const moveSchemaEntityToTrash = useMoveSchemaEntityToTrash();
  const [schemaId, setSchemaId] = useAtom(selectedSchemaIdAtom);
  const now = useNow();
  const selected = schemaId === entity.id;

  const handleStartEditing = () => {
    setName(entity.name);
    setIsEditing(true);
  };

  const handleStopEditing = () => {
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
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.code === 'Enter') {
      handleStopEditing();
    } else if (event.code === 'Escape') {
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

  return (
    <Flex
      css={[
        !isEditing && styles.hover,
        isEditing ? styles.inputPadding : styles.padding,
        styles.item,
      ]}
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
          css={styles.text}
          value={name}
          placeholder="schema name"
          autoFocus
          onChange={handleChange}
          onBlur={handleStopEditing}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <Text
          css={[styles.text, styles.ellipsis]}
          size="2"
          onDoubleClick={handleStartEditing}
        >
          {entity.name}
        </Text>
      )}

      <SidebarCollaborative entity={entity} />

      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger>
          <DotsHorizontalIcon width="16" height="16" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item onClick={handleStartEditing}>
            <Pencil size={16} />
            Rename
          </DropdownMenu.Item>
          <DropdownMenu.Item onClick={() => duplicateSchemaEntity(entity.id)}>
            <Copy size={16} />
            Duplicate
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            color="red"
            onClick={() => moveSchemaEntityToTrash(entity.id)}
          >
            <Trash2 size={16} />
            Move to trash
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Flex>
  );
};

export default SidebarItem;

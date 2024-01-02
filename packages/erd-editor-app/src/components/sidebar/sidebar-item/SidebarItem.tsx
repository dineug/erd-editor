import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import {
  AlertDialog,
  Button,
  DropdownMenu,
  Flex,
  Quote,
  Text,
  TextField,
} from '@radix-ui/themes';
import { useAtom } from 'jotai';
import { isEmpty } from 'lodash-es';
import { useState } from 'react';

import {
  useDeleteSchemaEntity,
  useUpdateSchemaEntity,
} from '@/atoms/modules/schema';
import { selectedSchemaIdAtom } from '@/atoms/modules/sidebar';
import SidebarCollaborative from '@/components/sidebar/sidebar-item/sidebar-collaborative/SidebarCollaborative';
import { SchemaEntity } from '@/services/indexeddb/modules/schema';

import * as styles from './SidebarItem.styles';

interface SidebarItemProps {
  entity: Omit<SchemaEntity, 'value'>;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ entity }) => {
  const [name, setName] = useState(entity.name);
  const [isEditing, setIsEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const updateSchemaEntity = useUpdateSchemaEntity();
  const deleteSchemaEntity = useDeleteSchemaEntity();
  const [schemaId, setSchemaId] = useAtom(selectedSchemaIdAtom);
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

  return (
    <Flex
      css={[
        !isEditing && styles.hover,
        isEditing ? styles.inputPadding : styles.padding,
        styles.item,
      ]}
      align="center"
      data-selected={selected && !isEditing}
      data-open-menu={open}
      onClick={() => setSchemaId(entity.id)}
    >
      {isEditing ? (
        <TextField.Root css={styles.text}>
          <TextField.Input
            value={name}
            placeholder="schema name"
            autoFocus
            onChange={handleChange}
            onBlur={handleStopEditing}
            onKeyDown={handleKeyDown}
          />
        </TextField.Root>
      ) : (
        <Text
          css={[styles.text, styles.ellipsis]}
          size="2"
          onDoubleClick={handleStartEditing}
        >
          {entity.name}
        </Text>
      )}

      {/* <SidebarCollaborative entity={entity} /> */}

      <AlertDialog.Root>
        <DropdownMenu.Root open={open} onOpenChange={setOpen}>
          <DropdownMenu.Trigger>
            <DotsHorizontalIcon width="16" height="16" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item onClick={handleStartEditing}>
              Rename
            </DropdownMenu.Item>
            <AlertDialog.Trigger>
              <DropdownMenu.Item color="red">Delete</DropdownMenu.Item>
            </AlertDialog.Trigger>
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        <AlertDialog.Content style={{ maxWidth: 450 }}>
          <AlertDialog.Title>Delete</AlertDialog.Title>
          <AlertDialog.Description size="2">
            Are you sure? <Quote>{entity.name}</Quote>
          </AlertDialog.Description>

          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action onClick={() => deleteSchemaEntity(entity.id)}>
              <Button variant="solid" color="red">
                Delete
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Flex>
  );
};

export default SidebarItem;

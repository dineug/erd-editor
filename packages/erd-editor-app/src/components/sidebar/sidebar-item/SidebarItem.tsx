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
import { isEmpty } from 'lodash-es';
import { useEffect, useState } from 'react';

import * as styles from './SidebarItem.styles';

interface SidebarItemProps {
  selected?: boolean;
  value: string;
  onChange: (value: string) => void;
  onDelete: () => void;
  onSelect: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = props => {
  const [name, setName] = useState(props.value);
  const [isEditing, setIsEditing] = useState(false);
  const [open, setOpen] = useState(false);

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleStopEditing = () => {
    const newName = isEmpty(name.trim()) ? props.value : name;
    if (newName !== props.value) {
      props.onChange(newName);
    }
    setIsEditing(false);
    setName(newName);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setName(props.value);
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

  useEffect(() => {
    setName(props.value);
  }, [props.value]);

  return (
    <Flex
      css={[
        !isEditing && styles.hover,
        isEditing ? styles.inputPadding : styles.padding,
        styles.item,
      ]}
      align="center"
      data-selected={props.selected && !isEditing}
      data-open-menu={open}
      onClick={props.onSelect}
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
          {props.value}
        </Text>
      )}
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
            Are you sure? <Quote>{props.value}</Quote>
          </AlertDialog.Description>

          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action onClick={props.onDelete}>
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

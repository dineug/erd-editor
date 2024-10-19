import { Flex, TextField } from '@radix-ui/themes';
import { isEmpty } from 'lodash-es';
import { useState } from 'react';

import * as itemStyles from '@/components/sidebar/sidebar-item/SidebarItem.styles';

interface SidebarAddItemProps {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

const SidebarAddItem: React.FC<SidebarAddItemProps> = props => {
  const [name, setName] = useState('');

  const handleStopEditing = () => {
    const value = name.trim();
    isEmpty(value) ? props.onCancel() : props.onConfirm(value);
  };

  const handleCancelEditing = () => {
    props.onCancel();
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
    <Flex css={[itemStyles.inputPadding, itemStyles.item]} align="center">
      <TextField.Root css={itemStyles.text}>
        <TextField.Input
          value={name}
          placeholder="schema name"
          autoFocus
          onChange={handleChange}
          onBlur={handleStopEditing}
          onKeyDown={handleKeyDown}
        />
      </TextField.Root>
    </Flex>
  );
};

export default SidebarAddItem;

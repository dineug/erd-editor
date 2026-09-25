import { Flex, TextField } from '@radix-ui/themes';
import { isEmpty } from 'es-toolkit/compat';
import { useState } from 'react';

import * as itemStyles from '@/components/sidebar/sidebar-item/sidebar-item-view/SidebarItemView.styles';

interface SidebarAddItemProps {
  /** The name of the field. */
  inputLabel: string;
  inputPlaceholder: string;
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

    if (event.key === 'Enter') {
      handleStopEditing();
    } else if (event.key === 'Escape') {
      handleCancelEditing();
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };

  return (
    <Flex css={itemStyles.item} align="center">
      <TextField.Root
        css={[itemStyles.text, itemStyles.input]}
        value={name}
        placeholder={props.inputPlaceholder}
        aria-label={props.inputLabel}
        autoFocus
        onChange={handleChange}
        onBlur={handleStopEditing}
        onKeyDown={handleKeyDown}
      />
    </Flex>
  );
};

export default SidebarAddItem;

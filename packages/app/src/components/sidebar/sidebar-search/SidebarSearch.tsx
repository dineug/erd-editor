import { TextField } from '@radix-ui/themes';
import { Search } from 'lucide-react';

import { focusSchemaItem } from '@/components/sidebar/sidebar-item/sidebarItemFocus';

interface SidebarSearchProps {
  /** The name of the field, since its placeholder is only Search. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** The list ArrowDown moves into, at its first item. */
  listRef: React.RefObject<HTMLElement | null>;
}

const SidebarSearch: React.FC<SidebarSearchProps> = ({
  label,
  value,
  onChange,
  listRef,
}) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      onChange('');
      event.currentTarget.blur();
    } else if (event.key === 'ArrowDown' && listRef.current) {
      event.preventDefault();
      focusSchemaItem(listRef.current, 0);
    }
  };

  return (
    <TextField.Root
      type="search"
      value={value}
      placeholder="Search"
      aria-label={label}
      onChange={event => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
    >
      <TextField.Slot>
        <Search size={16} />
      </TextField.Slot>
    </TextField.Root>
  );
};

export default SidebarSearch;

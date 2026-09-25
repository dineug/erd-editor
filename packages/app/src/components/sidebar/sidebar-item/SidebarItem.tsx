import { DropdownMenu } from '@radix-ui/themes';
import { useAtom } from 'jotai';
import { Copy } from 'lucide-react';

import {
  useDuplicateSchemaEntity,
  useMoveSchemaEntityToTrash,
  useNow,
  useUpdateSchemaEntity,
} from '@/atoms/modules/schema';
import { selectedSchemaIdAtom } from '@/atoms/modules/sidebar';
import SidebarCollaborative from '@/components/sidebar/sidebar-item/sidebar-collaborative/SidebarCollaborative';
import SidebarItemView from '@/components/sidebar/sidebar-item/sidebar-item-view/SidebarItemView';
import { SchemaEntity } from '@/services/indexeddb/modules/schema';
import { formatRelativeTime } from '@/utils/schemaList';

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
  const updateSchemaEntity = useUpdateSchemaEntity();
  const duplicateSchemaEntity = useDuplicateSchemaEntity();
  const moveSchemaEntityToTrash = useMoveSchemaEntityToTrash();
  const [schemaId, setSchemaId] = useAtom(selectedSchemaIdAtom);
  const now = useNow();

  return (
    <SidebarItemView
      name={entity.name}
      selected={schemaId === entity.id}
      tabStop={tabStop}
      title={`Edited ${formatRelativeTime(entity.updateAt, now)}`}
      inputLabel="Schema name"
      inputPlaceholder="schema name"
      menuItems={
        <DropdownMenu.Item onClick={() => duplicateSchemaEntity(entity.id)}>
          <Copy size={16} />
          Duplicate
        </DropdownMenu.Item>
      }
      trailing={<SidebarCollaborative entity={entity} tabStop={tabStop} />}
      removeLabel="Move to trash"
      onFocus={() => onFocus(entity.id)}
      onSelect={() => setSchemaId(entity.id)}
      onRename={name =>
        updateSchemaEntity({ id: entity.id, entityValue: { name } })
      }
      onRemove={() => moveSchemaEntityToTrash(entity.id)}
    />
  );
};

export default SidebarItem;

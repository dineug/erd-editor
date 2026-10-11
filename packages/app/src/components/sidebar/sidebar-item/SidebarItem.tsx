import { DropdownMenu } from '@radix-ui/themes';
import { useAtom } from 'jotai';
import { Copy } from 'lucide-react';

import { useI18n } from '@/atoms/modules/locale';
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
  const i18n = useI18n();
  const { t } = i18n;

  return (
    <SidebarItemView
      name={entity.name}
      selected={schemaId === entity.id}
      tabStop={tabStop}
      title={t('common.edited', {
        time: formatRelativeTime(entity.updateAt, now, i18n),
      })}
      inputLabel={t('sidebar.schemaName')}
      inputPlaceholder={t('sidebar.schemaNamePlaceholder')}
      menuItems={
        <DropdownMenu.Item onClick={() => duplicateSchemaEntity(entity.id)}>
          <Copy size={16} />
          {t('sidebar.duplicate')}
        </DropdownMenu.Item>
      }
      trailing={<SidebarCollaborative entity={entity} tabStop={tabStop} />}
      removeLabel={t('sidebar.moveToTrash')}
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

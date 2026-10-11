import { DropdownMenu } from '@radix-ui/themes';
import { useAtom, useAtomValue } from 'jotai';
import { Download, FileUp } from 'lucide-react';
import { useEffect } from 'react';

import { useUpdateCollaborativeSessionAll } from '@/atoms/modules/collaborative';
import { useI18n } from '@/atoms/modules/locale';
import {
  useAddSchemaEntity,
  useNow,
  usePurgeExpiredTrash,
  useSchemaEntities,
  useUpdateSchemaEntities,
} from '@/atoms/modules/schema';
import {
  useExportBackup,
  useImportingFiles,
  useOpenImportDialog,
} from '@/atoms/modules/schema-import';
import {
  addingSchemaAtom,
  selectedSchemaIdAtom,
} from '@/atoms/modules/sidebar';
import { sidebarSashAtom } from '@/atoms/modules/sidebar-sash';
import SidebarAddItem from '@/components/sidebar/sidebar-add-item/SidebarAddItem';
import SidebarAppearance from '@/components/sidebar/sidebar-appearance/SidebarAppearance';
import SidebarGroups from '@/components/sidebar/sidebar-groups/SidebarGroups';
import SidebarHeaderRow from '@/components/sidebar/sidebar-header-row/SidebarHeaderRow';
import SidebarItem from '@/components/sidebar/sidebar-item/SidebarItem';
import SidebarLocale from '@/components/sidebar/sidebar-locale/SidebarLocale';
import SidebarPolicyLinks from '@/components/sidebar/sidebar-policy-links/SidebarPolicyLinks';
import SidebarSearch from '@/components/sidebar/sidebar-search/SidebarSearch';
import SidebarShell from '@/components/sidebar/sidebar-shell/SidebarShell';
import SidebarTrash from '@/components/sidebar/sidebar-trash/SidebarTrash';
import { useSidebarList } from '@/components/sidebar/useSidebarList';

import * as styles from './Sidebar.styles';

interface SidebarProps {}

const Sidebar: React.FC<SidebarProps> = () => {
  const schemaEntities = useSchemaEntities();
  const updateSchemaEntities = useUpdateSchemaEntities();
  const updateCollaborativeSessionAll = useUpdateCollaborativeSessionAll();
  const addSchemaEntity = useAddSchemaEntity();
  const openImportDialog = useOpenImportDialog();
  const importingFiles = useImportingFiles();
  const exportBackup = useExportBackup();
  const [isEditing, setIsEditing] = useAtom(addingSchemaAtom);
  const selectedId = useAtomValue(selectedSchemaIdAtom);
  const sashState = useAtomValue(sidebarSashAtom);
  const now = useNow();
  const list = useSidebarList(schemaEntities, now, selectedId);
  const { t } = useI18n();

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
  };

  useEffect(() => {
    updateSchemaEntities();
    updateCollaborativeSessionAll();
  }, [updateSchemaEntities, updateCollaborativeSessionAll]);

  usePurgeExpiredTrash();

  return (
    <SidebarShell
      label={t('sidebar.schemas')}
      open={sashState.open}
      header={
        <>
          <SidebarHeaderRow
            addLabel={t('sidebar.newSchema')}
            onAdd={handleStartEditing}
            menuLabel={t('sidebar.importAndExport')}
            menuItems={
              <>
                <DropdownMenu.Item
                  disabled={importingFiles}
                  onSelect={() => openImportDialog()}
                >
                  <FileUp size={16} />
                  {t('common.importFiles')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  disabled={!schemaEntities.length}
                  onSelect={() => exportBackup()}
                >
                  <Download size={16} />
                  {t('sidebar.exportBackup')}
                </DropdownMenu.Item>
              </>
            }
          />
          <SidebarSearch
            label={t('sidebar.searchSchemas')}
            value={list.query}
            onChange={list.setQuery}
            listRef={list.listRef}
          />
        </>
      }
      footer={
        <>
          <div css={styles.footerTrash}>
            <SidebarTrash />
          </div>
          <SidebarAppearance />
        </>
      }
      legal={
        <>
          <SidebarPolicyLinks />
          <SidebarLocale />
        </>
      }
    >
      <SidebarGroups
        groups={list.groups}
        noResults={list.noResults}
        listRef={list.listRef}
        leading={
          isEditing ? (
            <SidebarAddItem
              inputLabel={t('sidebar.newSchemaName')}
              inputPlaceholder={t('sidebar.schemaNamePlaceholder')}
              onConfirm={name => {
                handleCancelEditing();
                addSchemaEntity({ name });
              }}
              onCancel={handleCancelEditing}
            />
          ) : null
        }
        renderItem={entity => (
          <SidebarItem
            entity={entity}
            tabStop={entity.id === list.tabStopId}
            onFocus={list.setFocusedId}
          />
        )}
      />
    </SidebarShell>
  );
};

export default Sidebar;

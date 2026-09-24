import { Button, DropdownMenu, Flex, IconButton } from '@radix-ui/themes';
import { useAtom, useAtomValue } from 'jotai';
import { Download, EllipsisVertical, FileUp, SquarePen } from 'lucide-react';
import { useEffect } from 'react';

import { useUpdateCollaborativeSessionAll } from '@/atoms/modules/collaborative';
import {
  useAddSchemaEntity,
  useNow,
  usePurgeExpiredTrash,
  useSchemaEntities,
  useUpdateSchemaEntities,
} from '@/atoms/modules/schema';
import {
  useExportBackup,
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
import SidebarItem from '@/components/sidebar/sidebar-item/SidebarItem';
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
  const exportBackup = useExportBackup();
  const [isEditing, setIsEditing] = useAtom(addingSchemaAtom);
  const selectedId = useAtomValue(selectedSchemaIdAtom);
  const sashState = useAtomValue(sidebarSashAtom);
  const now = useNow();
  const list = useSidebarList(schemaEntities, now, selectedId);

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
      label="Schemas"
      open={sashState.open}
      header={
        <>
          <Flex align="center" gap="1">
            <Button
              css={styles.addButton}
              size="2"
              variant="ghost"
              color="gray"
              highContrast
              onClick={handleStartEditing}
            >
              <SquarePen size={16} />
              New schema
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <IconButton
                  css={styles.menuButton}
                  size="2"
                  variant="ghost"
                  color="gray"
                  aria-label="Import and export"
                >
                  <EllipsisVertical size={16} />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onSelect={() => openImportDialog()}>
                  <FileUp size={16} />
                  Import files
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  disabled={!schemaEntities.length}
                  onSelect={() => exportBackup()}
                >
                  <Download size={16} />
                  Export backup
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Flex>
          <SidebarSearch
            label="Search schemas"
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
    >
      <SidebarGroups
        groups={list.groups}
        noResults={list.noResults}
        listRef={list.listRef}
        leading={
          isEditing ? (
            <SidebarAddItem
              inputLabel="New schema name"
              inputPlaceholder="schema name"
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

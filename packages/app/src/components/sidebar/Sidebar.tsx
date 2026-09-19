import {
  Button,
  DropdownMenu,
  Flex,
  IconButton,
  ScrollArea,
  Text,
  TextField,
} from '@radix-ui/themes';
import { useAtom, useAtomValue } from 'jotai';
import { Download, EllipsisVertical, FileUp, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';

import { useUpdateCollaborativeSessionAll } from '@/atoms/modules/collaborative';
import {
  useAddSchemaEntity,
  useNow,
  useSchemaEntities,
  useUpdateSchemaEntities,
} from '@/atoms/modules/schema';
import {
  useExportBackup,
  useOpenImportDialog,
} from '@/atoms/modules/schema-import';
import { addingSchemaAtom } from '@/atoms/modules/sidebar';
import { sidebarSashAtom } from '@/atoms/modules/sidebar-sash';
import SidebarAddItem from '@/components/sidebar/sidebar-add-item/SidebarAddItem';
import SidebarItem from '@/components/sidebar/sidebar-item/SidebarItem';
import SidebarTrash from '@/components/sidebar/sidebar-trash/SidebarTrash';
import { filterSchemasByName, groupSchemasByDate } from '@/utils/schemaList';

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
  const [query, setQuery] = useState('');
  const sashState = useAtomValue(sidebarSashAtom);
  const groupId = useId();
  const now = useNow();

  const groups = useMemo(
    () => groupSchemasByDate(filterSchemasByName(schemaEntities, query), now),
    [schemaEntities, query, now]
  );
  const noResults = query.trim() !== '' && groups.length === 0;

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setQuery('');
      event.currentTarget.blur();
    }
  };

  useEffect(() => {
    updateSchemaEntities();
    updateCollaborativeSessionAll();
  }, [updateSchemaEntities, updateCollaborativeSessionAll]);

  return (
    <>
      <Flex
        css={[styles.root, sashState.open ? null : styles.hide]}
        direction="column"
      >
        <Flex css={styles.header} direction="column" gap="2">
          <Flex align="center" gap="1">
            <Button
              css={styles.addButton}
              size="3"
              variant="soft"
              onClick={handleStartEditing}
            >
              New Schema
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
                  Import…
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
          <TextField.Root
            type="search"
            value={query}
            placeholder="Search"
            aria-label="Search schemas"
            onChange={event => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          >
            <TextField.Slot>
              <Search size={16} />
            </TextField.Slot>
          </TextField.Root>
        </Flex>
        <ScrollArea css={styles.scrollArea} scrollbars="vertical">
          <Flex css={styles.contentArea} direction="column">
            {isEditing ? (
              <SidebarAddItem
                onConfirm={name => {
                  handleCancelEditing();
                  addSchemaEntity({ name });
                }}
                onCancel={handleCancelEditing}
              />
            ) : null}
            {groups.map((group, index) => (
              <Flex
                key={group.label}
                css={styles.group}
                direction="column"
                role="group"
                aria-labelledby={`${groupId}-${index}`}
              >
                <Text
                  id={`${groupId}-${index}`}
                  css={styles.groupLabel}
                  size="1"
                  color="gray"
                >
                  {group.label}
                </Text>
                {group.entities.map(entity => (
                  <SidebarItem key={entity.id} entity={entity} />
                ))}
              </Flex>
            ))}
            {noResults ? (
              <Text css={styles.noResults} size="2" color="gray">
                No results
              </Text>
            ) : null}
          </Flex>
        </ScrollArea>
        <Flex css={styles.footer} align="center" gap="3">
          <div css={styles.footerTrash}>
            <SidebarTrash />
          </div>
        </Flex>
      </Flex>
      <Flex css={[styles.empty, sashState.open ? styles.hide : null]}></Flex>
    </>
  );
};

export default Sidebar;

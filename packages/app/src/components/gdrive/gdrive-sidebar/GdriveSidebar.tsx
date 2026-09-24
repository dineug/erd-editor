import { Button, DropdownMenu, Flex, IconButton, Text } from '@radix-ui/themes';
import { useAtomValue } from 'jotai';
import { EllipsisVertical, FileUp, LogOut, SquarePen } from 'lucide-react';
import { useMemo } from 'react';

import { useNow } from '@/atoms/modules/schema';
import { sidebarSashAtom } from '@/atoms/modules/sidebar-sash';
import { authControl } from '@/components/gdrive/authControl';
import SidebarAddItem from '@/components/sidebar/sidebar-add-item/SidebarAddItem';
import SidebarAppearance from '@/components/sidebar/sidebar-appearance/SidebarAppearance';
import SidebarGroups from '@/components/sidebar/sidebar-groups/SidebarGroups';
import SidebarItemView from '@/components/sidebar/sidebar-item/sidebar-item-view/SidebarItemView';
import SidebarSearch from '@/components/sidebar/sidebar-search/SidebarSearch';
import SidebarShell from '@/components/sidebar/sidebar-shell/SidebarShell';
import { useSidebarList } from '@/components/sidebar/useSidebarList';
import type { GdriveSession, SessionSnapshot } from '@/services/gdrive';
import { settleReported } from '@/utils/reportError';
import { formatRelativeTime } from '@/utils/schemaList';

import * as styles from './GdriveSidebar.styles';

interface GdriveSidebarProps {
  session: GdriveSession;
  snapshot: SessionSnapshot;
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
  onImport: () => void;
}

/**
 * The Drive adapter of the sidebar fragments: the account's files by
 * modifiedTime, New file, Import, rename keeping the extension, and the
 * account's email with Sign out. No duplicate, trash or backup.
 */
const GdriveSidebar: React.FC<GdriveSidebarProps> = ({
  session,
  snapshot,
  adding,
  onAddingChange,
  onImport,
}) => {
  const sashState = useAtomValue(sidebarSashAtom);
  const now = useNow();
  const entries = useMemo(
    () =>
      snapshot.files.map(file => ({
        id: file.id,
        name: file.name,
        updateAt: Date.parse(file.modifiedTime) || 0,
        canRename: file.canRename,
      })),
    [snapshot.files]
  );
  const openId = snapshot.controller?.fileId ?? null;
  const list = useSidebarList(entries, now, openId);
  const email = snapshot.token.account?.email ?? '';

  const handleNewFile = (name: string) => {
    onAddingChange(false);
    void settleReported(session.newFile)(name);
  };

  return (
    <SidebarShell
      label="Drive files"
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
              onClick={() => onAddingChange(true)}
            >
              <SquarePen size={16} />
              New file
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <IconButton
                  css={styles.menuButton}
                  size="2"
                  variant="ghost"
                  color="gray"
                  aria-label="Import"
                >
                  <EllipsisVertical size={16} />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item
                  disabled={snapshot.importing}
                  onSelect={onImport}
                >
                  <FileUp size={16} />
                  Import files
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Flex>
          <SidebarSearch
            label="Search files"
            value={list.query}
            onChange={list.setQuery}
            listRef={list.listRef}
          />
        </>
      }
      footer={
        <>
          <Text css={styles.email} size="1" color="gray" title={email}>
            {email}
          </Text>
          <IconButton
            css={styles.signOut}
            size="2"
            variant="ghost"
            color="gray"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => void settleReported(session.signOut)()}
            {...authControl}
          >
            <LogOut size={16} />
          </IconButton>
          <SidebarAppearance />
        </>
      }
    >
      <SidebarGroups
        groups={list.groups}
        noResults={list.noResults}
        listRef={list.listRef}
        leading={
          <>
            {adding ? (
              <SidebarAddItem
                inputLabel="New file name"
                inputPlaceholder="file name"
                onConfirm={handleNewFile}
                onCancel={() => onAddingChange(false)}
              />
            ) : null}
            {snapshot.filesState === 'loading' && !entries.length ? (
              <Text css={styles.listNote} size="2" color="gray">
                Loading files…
              </Text>
            ) : null}
            {snapshot.filesState === 'failed' ? (
              <Flex css={styles.listNote} direction="column" gap="2">
                <Text size="2" color="gray">
                  Couldn&apos;t load your files.
                </Text>
                <Button
                  size="2"
                  variant="outline"
                  color="gray"
                  onClick={() => void settleReported(session.refreshFiles)()}
                >
                  Try again
                </Button>
              </Flex>
            ) : null}
          </>
        }
        renderItem={file => (
          <SidebarItemView
            name={file.name}
            selected={file.id === openId}
            tabStop={file.id === list.tabStopId}
            title={`Edited ${formatRelativeTime(file.updateAt, now)}`}
            inputLabel="File name"
            inputPlaceholder="file name"
            renameDisabled={!file.canRename}
            onFocus={() => list.setFocusedId(file.id)}
            onSelect={() => session.openFile(file.id)}
            onRename={name =>
              void settleReported(session.renameFile)(file.id, name)
            }
          />
        )}
      />
    </SidebarShell>
  );
};

export default GdriveSidebar;

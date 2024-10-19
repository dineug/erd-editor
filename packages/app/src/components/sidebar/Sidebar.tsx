import { Button, Flex, ScrollArea } from '@radix-ui/themes';
import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';

import { useUpdateCollaborativeSessionAll } from '@/atoms/modules/collaborative';
import {
  useAddSchemaEntity,
  useSchemaEntities,
  useUpdateSchemaEntities,
} from '@/atoms/modules/schema';
import { sidebarSashAtom } from '@/atoms/modules/sidebar-sash';
import SidebarAddItem from '@/components/sidebar/sidebar-add-item/SidebarAddItem';
import SidebarItem from '@/components/sidebar/sidebar-item/SidebarItem';

import * as styles from './Sidebar.styles';

interface SidebarProps {}

const Sidebar: React.FC<SidebarProps> = () => {
  const schemaEntities = useSchemaEntities();
  const updateSchemaEntities = useUpdateSchemaEntities();
  const updateCollaborativeSessionAll = useUpdateCollaborativeSessionAll();
  const addSchemaEntity = useAddSchemaEntity();
  const [isEditing, setIsEditing] = useState(false);
  const sashState = useAtomValue(sidebarSashAtom);

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

  return (
    <>
      <Flex
        css={[styles.root, sashState.open ? null : styles.hide]}
        direction="column"
      >
        <Flex css={styles.header}>
          <Button
            css={styles.addButton}
            size="3"
            variant="soft"
            onClick={handleStartEditing}
          >
            New Schema
          </Button>
        </Flex>
        <ScrollArea scrollbars="vertical">
          <Flex css={styles.contentArea} direction="column">
            {schemaEntities.map(entity => (
              <SidebarItem key={entity.id} entity={entity} />
            ))}
            {isEditing ? (
              <SidebarAddItem
                onConfirm={name => {
                  handleCancelEditing();
                  addSchemaEntity({ name });
                }}
                onCancel={handleCancelEditing}
              />
            ) : null}
          </Flex>
        </ScrollArea>
      </Flex>
      <Flex css={[styles.empty, sashState.open ? styles.hide : null]}></Flex>
    </>
  );
};

export default Sidebar;

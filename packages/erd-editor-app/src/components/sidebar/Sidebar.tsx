import { Button, Flex, ScrollArea } from '@radix-ui/themes';
import { useAtom } from 'jotai';
import { useEffect, useState } from 'react';

import {
  useAddSchemaEntity,
  useDeleteSchemaEntity,
  useSchemaEntities,
  useUpdateSchemaEntities,
  useUpdateSchemaEntity,
} from '@/atoms/modules/schema';
import { selectedSchemaIdAtom } from '@/atoms/modules/sidebar';
import SidebarAddItem from '@/components/sidebar/sidebar-add-item/SidebarAddItem';
import SidebarItem from '@/components/sidebar/sidebar-item/SidebarItem';

import * as styles from './Sidebar.styles';

interface SidebarProps {}

const Sidebar: React.FC<SidebarProps> = () => {
  const schemaEntities = useSchemaEntities();
  const updateSchemaEntities = useUpdateSchemaEntities();
  const updateSchemaEntity = useUpdateSchemaEntity();
  const deleteSchemaEntity = useDeleteSchemaEntity();
  const addSchemaEntity = useAddSchemaEntity();
  const [schemaId, setSchemaId] = useAtom(selectedSchemaIdAtom);
  const [isEditing, setIsEditing] = useState(false);

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
  };

  useEffect(() => {
    updateSchemaEntities();
  }, [updateSchemaEntities]);

  return (
    <Flex css={styles.root} direction="column">
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
            <SidebarItem
              key={entity.id}
              value={entity.name}
              selected={schemaId === entity.id}
              onChange={name => {
                updateSchemaEntity({ id: entity.id, entityValue: { name } });
              }}
              onDelete={() => deleteSchemaEntity(entity.id)}
              onSelect={() => setSchemaId(entity.id)}
            />
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
  );
};

export default Sidebar;

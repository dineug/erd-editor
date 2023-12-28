import { Flex, ScrollArea } from '@radix-ui/themes';
import { useAtom } from 'jotai';
import { useEffect } from 'react';

import SidebarItem from '@/components/sidebar/sidebar-item/SidebarItem';
import {
  useDeleteSchemaEntity,
  useSchemaEntities,
  useUpdateSchemaEntities,
  useUpdateSchemaEntity,
} from '@/store/modules/schema';
import { selectedSchemaIdAtom } from '@/store/modules/sidebar';

import * as styles from './Sidebar.styles';

interface SidebarProps {}

const Sidebar: React.FC<SidebarProps> = () => {
  const schemaEntities = useSchemaEntities();
  const updateSchemaEntities = useUpdateSchemaEntities();
  const updateSchemaEntity = useUpdateSchemaEntity();
  const deleteSchemaEntity = useDeleteSchemaEntity();
  const [schemaId, setSchemaId] = useAtom(selectedSchemaIdAtom);

  useEffect(() => {
    updateSchemaEntities();
  }, [updateSchemaEntities]);

  return (
    <Flex css={styles.root} direction="column">
      <Flex css={styles.header}>header</Flex>
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
        </Flex>
      </ScrollArea>
    </Flex>
  );
};

export default Sidebar;

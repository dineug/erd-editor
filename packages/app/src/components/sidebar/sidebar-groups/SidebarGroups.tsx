import { Flex, Text } from '@radix-ui/themes';
import { Fragment, useId } from 'react';

import type { SidebarListEntity } from '@/components/sidebar/useSidebarList';
import type { SchemaGroup } from '@/utils/schemaList';

import * as styles from './SidebarGroups.styles';

interface SidebarGroupsProps<T extends SidebarListEntity> {
  groups: Array<SchemaGroup<T>>;
  /** Whether a search left nothing to list. */
  noResults: boolean;
  listRef: React.Ref<HTMLDivElement>;
  /** A row above the groups, such as the name field of a new entry. */
  leading?: React.ReactNode;
  renderItem: (entity: T) => React.ReactNode;
}

function SidebarGroups<T extends SidebarListEntity>({
  groups,
  noResults,
  listRef,
  leading,
  renderItem,
}: SidebarGroupsProps<T>) {
  const groupId = useId();

  return (
    <Flex
      css={styles.contentArea}
      ref={listRef}
      direction="column"
      data-schema-list
    >
      {leading}
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
            <Fragment key={entity.id}>{renderItem(entity)}</Fragment>
          ))}
        </Flex>
      ))}
      {noResults ? (
        <Text css={styles.noResults} size="2" color="gray">
          No results
        </Text>
      ) : null}
    </Flex>
  );
}

export default SidebarGroups;

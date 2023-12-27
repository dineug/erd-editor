import { Box, Flex, ScrollArea } from '@radix-ui/themes';

import * as styles from './Sidebar.styles';

interface SidebarProps {}

const Sidebar: React.FC<SidebarProps> = () => {
  return (
    <Flex css={styles.root} direction="column">
      <Flex css={styles.header}>header</Flex>
      <ScrollArea scrollbars="vertical">
        <Flex css={styles.contentArea} direction="column">
          <div>sidebar</div>
          <Box style={{ height: 1200 }} />
        </Flex>
      </ScrollArea>
    </Flex>
  );
};

export default Sidebar;

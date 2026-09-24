import { Flex, ScrollArea } from '@radix-ui/themes';

import * as styles from './SidebarShell.styles';

interface SidebarShellProps {
  /** The name of the nav landmark. */
  label: string;
  /** False while the sash keeps the sidebar folded down to its bar. */
  open: boolean;
  header: React.ReactNode;
  footer: React.ReactNode;
  /** The list, scrolled between the header and the footer. */
  children: React.ReactNode;
}

const SidebarShell: React.FC<SidebarShellProps> = ({
  label,
  open,
  header,
  footer,
  children,
}) => (
  <>
    <Flex
      css={[styles.root, open ? null : styles.hide]}
      direction="column"
      asChild
    >
      <nav aria-label={label}>
        <Flex css={styles.header} direction="column" gap="2">
          {header}
        </Flex>
        <ScrollArea css={styles.scrollArea} scrollbars="vertical">
          {children}
        </ScrollArea>
        <Flex css={styles.footer} align="center" gap="3">
          {footer}
        </Flex>
      </nav>
    </Flex>
    <Flex css={[styles.empty, open ? styles.hide : null]}></Flex>
  </>
);

export default SidebarShell;

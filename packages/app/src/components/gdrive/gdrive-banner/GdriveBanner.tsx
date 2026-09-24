import { Callout, Flex } from '@radix-ui/themes';
import { TriangleAlert } from 'lucide-react';

import * as styles from './GdriveBanner.styles';

interface GdriveBannerProps {
  message: React.ReactNode;
  /** The banner's buttons, the primary one last. */
  children?: React.ReactNode;
}

/** One line above the editor that saving has stopped or needs something, with what to do. */
const GdriveBanner: React.FC<GdriveBannerProps> = ({ message, children }) => (
  <Callout.Root
    css={styles.root}
    role="alert"
    size="1"
    variant="surface"
    color="amber"
  >
    <Callout.Icon>
      <TriangleAlert size={16} />
    </Callout.Icon>
    <Flex css={styles.body} align="center" gap="3" wrap="wrap">
      <Callout.Text>{message}</Callout.Text>
      {children ? (
        <Flex gap="2" wrap="wrap">
          {children}
        </Flex>
      ) : null}
    </Flex>
  </Callout.Root>
);

export default GdriveBanner;

import { Flex, Heading, Text } from '@radix-ui/themes';

import * as styles from './GdriveNotice.styles';

interface GdriveNoticeProps {
  title: string;
  description?: React.ReactNode;
  /** The buttons or links under the text; the first is the one primary action. */
  children?: React.ReactNode;
}

/** A screen of text and actions filling the space it is given: the route, or the viewer. */
const GdriveNotice: React.FC<GdriveNoticeProps> = ({
  title,
  description,
  children,
}) => (
  <Flex css={styles.root} direction="column" align="center" justify="center">
    <Flex css={styles.body} direction="column" align="center" gap="4">
      <Flex direction="column" align="center" gap="1">
        <Heading as="h1" size="5" weight="medium">
          {title}
        </Heading>
        {description ? (
          <Text as="p" size="2" color="gray">
            {description}
          </Text>
        ) : null}
      </Flex>
      {children ? (
        <Flex css={styles.actions} gap="2" justify="center" wrap="wrap">
          {children}
        </Flex>
      ) : null}
    </Flex>
  </Flex>
);

export default GdriveNotice;

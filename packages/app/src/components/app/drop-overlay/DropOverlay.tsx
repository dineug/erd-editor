import { Spinner, Text } from '@radix-ui/themes';
import { FileUp } from 'lucide-react';

import * as styles from './DropOverlay.styles';

interface DropOverlayProps {
  /** An import is under way, so a drop is refused until it ends. */
  importing: boolean;
}

const DropOverlay: React.FC<DropOverlayProps> = ({ importing }) => (
  <div css={styles.root} aria-hidden="true">
    <div css={styles.frame}>
      <div css={styles.card}>
        {importing ? (
          <>
            <Spinner size="3" />
            <Text size="5" weight="medium">
              Importing files…
            </Text>
            <Text size="2" color="gray">
              Drop more once this import finishes
            </Text>
          </>
        ) : (
          <>
            <FileUp size={32} />
            <Text size="5" weight="medium">
              Drop to import
            </Text>
            <Text size="2" color="gray">
              Backups, .erd, .vuerd and .json documents, SQL, DBML, AML and
              GraphQL
            </Text>
          </>
        )}
      </div>
    </div>
  </div>
);

export default DropOverlay;

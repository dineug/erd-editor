import { Text } from '@radix-ui/themes';
import { FileUp } from 'lucide-react';

import * as styles from './DropOverlay.styles';

interface DropOverlayProps {}

const DropOverlay: React.FC<DropOverlayProps> = () => (
  <div css={styles.root} aria-hidden="true">
    <div css={styles.frame}>
      <div css={styles.card}>
        <FileUp size={32} />
        <Text size="5" weight="medium">
          Drop to import
        </Text>
        <Text size="2" color="gray">
          Backups, .erd, .vuerd and .json documents, SQL, DBML, AML and GraphQL
        </Text>
      </div>
    </div>
  </div>
);

export default DropOverlay;

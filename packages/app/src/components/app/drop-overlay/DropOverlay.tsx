import { Spinner, Text } from '@radix-ui/themes';
import { FileUp } from 'lucide-react';

import { useI18n } from '@/atoms/modules/locale';

import * as styles from './DropOverlay.styles';

interface DropOverlayProps {
  /** An import is under way, so a drop is refused until it ends. */
  importing: boolean;
}

const DropOverlay: React.FC<DropOverlayProps> = ({ importing }) => {
  const { t } = useI18n();

  return (
    <div css={styles.root} aria-hidden="true">
      <div css={styles.frame}>
        <div css={styles.card}>
          {importing ? (
            <>
              <Spinner size="3" />
              <Text size="5" weight="medium">
                {t('drop.importing')}
              </Text>
              <Text size="2" color="gray">
                {t('drop.importingHint')}
              </Text>
            </>
          ) : (
            <>
              <FileUp size={32} />
              <Text size="5" weight="medium">
                {t('drop.title')}
              </Text>
              <Text size="2" color="gray">
                {t('drop.formats')}
              </Text>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DropOverlay;

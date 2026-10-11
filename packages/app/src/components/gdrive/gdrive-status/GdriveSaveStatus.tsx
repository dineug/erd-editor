import type { SerializedStyles } from '@emotion/react';
import { Button, Flex, Text } from '@radix-ui/themes';
import {
  CircleAlert,
  CircleCheck,
  CloudOff,
  Download,
  Eye,
  LoaderCircle,
  type LucideIcon,
} from 'lucide-react';

import { useI18n } from '@/atoms/modules/locale';
import type { PlainMessageKey } from '@/i18n/translate';
import type { GdriveSession, SaveState } from '@/services/gdrive';
import { settleReported } from '@/utils/reportError';

import * as styles from './GdriveSaveStatus.styles';

const LABELS: Record<
  SaveState,
  { textKey: PlainMessageKey; Icon: LucideIcon; iconCss?: SerializedStyles }
> = {
  saved: {
    textKey: 'gdrive.status.saved',
    Icon: CircleCheck,
    iconCss: styles.saved,
  },
  saving: {
    textKey: 'gdrive.status.saving',
    Icon: LoaderCircle,
    iconCss: styles.spinning,
  },
  failed: { textKey: 'gdrive.status.failed', Icon: CircleAlert },
  conflict: { textKey: 'gdrive.status.conflict', Icon: CircleAlert },
  unconfirmed: { textKey: 'gdrive.status.unconfirmed', Icon: CircleAlert },
  paused: { textKey: 'gdrive.status.paused', Icon: CloudOff },
  deleted: { textKey: 'gdrive.status.deleted', Icon: CircleAlert },
  readonly: { textKey: 'gdrive.status.readonly', Icon: Eye },
  'waiting-leader': {
    textKey: 'gdrive.status.waitingLeader',
    Icon: LoaderCircle,
    iconCss: styles.spinning,
  },
  'waiting-snapshot': {
    textKey: 'gdrive.status.waitingSnapshot',
    Icon: LoaderCircle,
    iconCss: styles.spinning,
  },
  'account-changed': {
    textKey: 'gdrive.accountChanged.title',
    Icon: CloudOff,
  },
  'scope-missing': { textKey: 'gdrive.status.scopeMissing', Icon: CloudOff },
};

interface GdriveSaveStatusProps {
  session: GdriveSession;
  state: SaveState;
}

/**
 * Where the open file's saves stand, for people and for the e2e specs
 * (data-save-state). A save that failed or waits for Google offers the edits.
 */
const GdriveSaveStatus: React.FC<GdriveSaveStatusProps> = ({
  session,
  state,
}) => {
  const { textKey, Icon, iconCss } = LABELS[state];
  const { t } = useI18n();

  return (
    <Flex
      css={styles.root}
      role="status"
      aria-live="polite"
      align="center"
      gap="2"
      data-save-state={state}
    >
      <Icon css={iconCss} size={14} aria-hidden />
      <Text size="1">{t(textKey)}</Text>
      {state === 'failed' ? (
        <Button
          size="1"
          variant="ghost"
          color="gray"
          onClick={() => void settleReported(session.retrySave)()}
        >
          {t('common.tryAgain')}
        </Button>
      ) : null}
      {state === 'failed' || state === 'paused' ? (
        <Button
          size="1"
          variant="ghost"
          color="gray"
          onClick={() => session.downloadChanges()}
        >
          <Download size={14} />
          {t('common.downloadMyChanges')}
        </Button>
      ) : null}
    </Flex>
  );
};

export default GdriveSaveStatus;

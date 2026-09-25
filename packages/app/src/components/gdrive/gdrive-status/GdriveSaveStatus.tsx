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

import type { GdriveSession, SaveState } from '@/services/gdrive';
import { settleReported } from '@/utils/reportError';

import * as styles from './GdriveSaveStatus.styles';

const LABELS: Record<
  SaveState,
  { text: string; Icon: LucideIcon; iconCss?: SerializedStyles }
> = {
  saved: {
    text: 'Saved to Google Drive',
    Icon: CircleCheck,
    iconCss: styles.saved,
  },
  saving: { text: 'Saving…', Icon: LoaderCircle, iconCss: styles.spinning },
  failed: { text: "Couldn't save", Icon: CircleAlert },
  conflict: { text: 'Changed in Google Drive', Icon: CircleAlert },
  unconfirmed: { text: "Couldn't confirm the last save", Icon: CircleAlert },
  paused: { text: 'Paused until Google reconnects', Icon: CloudOff },
  deleted: { text: 'Deleted in Google Drive', Icon: CircleAlert },
  readonly: { text: 'View only', Icon: Eye },
  'waiting-leader': {
    text: 'Waiting for the tab that saves this file',
    Icon: LoaderCircle,
    iconCss: styles.spinning,
  },
  'waiting-snapshot': {
    text: 'Waiting for the tab that opened this file',
    Icon: LoaderCircle,
    iconCss: styles.spinning,
  },
  'account-changed': { text: 'Signed in with another account', Icon: CloudOff },
  'scope-missing': { text: 'No Google Drive access', Icon: CloudOff },
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
  const { text, Icon, iconCss } = LABELS[state];

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
      <Text size="1">{text}</Text>
      {state === 'failed' ? (
        <Button
          size="1"
          variant="ghost"
          color="gray"
          onClick={() => void settleReported(session.retrySave)()}
        >
          Try again
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
          Download my changes
        </Button>
      ) : null}
    </Flex>
  );
};

export default GdriveSaveStatus;

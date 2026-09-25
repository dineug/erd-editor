import { Callout, Flex, IconButton } from '@radix-ui/themes';
import { CircleCheck, TriangleAlert, X } from 'lucide-react';
import { useEffect } from 'react';

import type { GdriveSession, SessionNotice } from '@/services/gdrive';

import * as styles from './GdriveSessionNotice.styles';

/** A success goes by itself; a warning, such as an unconfirmed sign-out, stays longer. */
const AUTO_DISMISS = { success: 5000, warning: 12_000 };

interface GdriveSessionNoticeProps {
  session: GdriveSession;
  notice: SessionNotice | null;
}

/**
 * The session's one-line notices: an import, a Drive link it could not read,
 * a rename, create, Drive check or reload that failed, a sign-out.
 */
const GdriveSessionNotice: React.FC<GdriveSessionNoticeProps> = ({
  session,
  notice,
}) => {
  const key = notice?.key;
  const tone = notice?.tone;

  useEffect(() => {
    if (key === undefined || !tone) return;
    const timer = window.setTimeout(
      () => session.dismissNotice(),
      AUTO_DISMISS[tone]
    );
    return () => window.clearTimeout(timer);
  }, [key, tone, session]);

  if (!notice) return null;

  return (
    <Callout.Root
      css={styles.root}
      role="status"
      size="1"
      variant="surface"
      color={notice.tone === 'success' ? undefined : 'amber'}
    >
      <Callout.Icon>
        {notice.tone === 'success' ? (
          <CircleCheck size={16} />
        ) : (
          <TriangleAlert size={16} />
        )}
      </Callout.Icon>
      <Flex align="center" gap="3">
        <Callout.Text>{notice.message}</Callout.Text>
        <IconButton
          size="1"
          variant="ghost"
          color="gray"
          aria-label="Dismiss"
          onClick={() => session.dismissNotice()}
        >
          <X size={14} />
        </IconButton>
      </Flex>
    </Callout.Root>
  );
};

export default GdriveSessionNotice;

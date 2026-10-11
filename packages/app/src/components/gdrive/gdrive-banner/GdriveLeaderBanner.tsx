import { Button } from '@radix-ui/themes';
import { useState } from 'react';

import { useI18n } from '@/atoms/modules/locale';
import GdriveBanner from '@/components/gdrive/gdrive-banner/GdriveBanner';
import type { GdriveSession } from '@/services/gdrive';
import { settleReported } from '@/utils/reportError';

interface GdriveLeaderBannerProps {
  session: GdriveSession;
  /** waiting-leader: saves go unanswered; waiting-snapshot: this tab never got the document. */
  state: 'waiting-leader' | 'waiting-snapshot';
}

/**
 * Another tab of this file holds its lock and stopped answering. Taking over
 * is the person's call: a leader that is only slow would be robbed otherwise.
 */
const GdriveLeaderBanner: React.FC<GdriveLeaderBannerProps> = ({
  session,
  state,
}) => {
  const [taking, setTaking] = useState(false);
  const { t } = useI18n();
  const waitingLeader = state === 'waiting-leader';

  const handleTakeOver = () => {
    setTaking(true);
    void settleReported(session.takeOver)().finally(() => setTaking(false));
  };

  return (
    <GdriveBanner
      message={t(
        waitingLeader
          ? 'gdrive.banner.leaderNotResponding'
          : 'gdrive.banner.openerNotResponding'
      )}
    >
      <Button
        size="2"
        color="gray"
        highContrast
        loading={taking}
        onClick={handleTakeOver}
      >
        {t(
          waitingLeader
            ? 'gdrive.banner.takeOver'
            : 'gdrive.banner.openAndTakeOver'
        )}
      </Button>
    </GdriveBanner>
  );
};

export default GdriveLeaderBanner;

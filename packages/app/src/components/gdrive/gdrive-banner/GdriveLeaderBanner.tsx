import { Button } from '@radix-ui/themes';
import { useState } from 'react';

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

  const handleTakeOver = () => {
    setTaking(true);
    void settleReported(session.takeOver)().finally(() => setTaking(false));
  };

  return (
    <GdriveBanner
      message={
        state === 'waiting-leader'
          ? "The tab that saves this file isn't responding."
          : "The tab that opened this file isn't responding."
      }
    >
      <Button
        size="2"
        color="gray"
        highContrast
        loading={taking}
        onClick={handleTakeOver}
      >
        {state === 'waiting-leader'
          ? 'Take over saving'
          : 'Open from Drive and take over'}
      </Button>
    </GdriveBanner>
  );
};

export default GdriveLeaderBanner;

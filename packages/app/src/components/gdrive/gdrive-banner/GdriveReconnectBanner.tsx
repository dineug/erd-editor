import { Button } from '@radix-ui/themes';

import { authControl } from '@/components/gdrive/authControl';
import GdriveBanner from '@/components/gdrive/gdrive-banner/GdriveBanner';
import type { GdriveSession } from '@/services/gdrive';

interface GdriveReconnectBannerProps {
  session: GdriveSession;
  /** Whether the hour of Google's own token is already over. */
  expired: boolean;
  error: 'popup-blocked' | 'failed' | null;
}

/**
 * The fallback's token lasts an hour and only a click may open Google's popup
 * again, so the banner asks for one; saves wait meanwhile and go out after.
 */
const GdriveReconnectBanner: React.FC<GdriveReconnectBannerProps> = ({
  session,
  expired,
  error,
}) => (
  <GdriveBanner
    message={
      error === 'popup-blocked'
        ? 'Your browser blocked the Google window. Allow pop-ups for this site, then reconnect.'
        : expired
          ? 'Your Google session ended, so saving is paused.'
          : 'Your Google session ends soon.'
    }
  >
    <Button
      size="2"
      color="gray"
      highContrast
      onClick={() => session.reconnect()}
      {...authControl}
    >
      Reconnect Google
    </Button>
  </GdriveBanner>
);

export default GdriveReconnectBanner;

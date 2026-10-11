import { Button } from '@radix-ui/themes';

import { useI18n } from '@/atoms/modules/locale';
import { authControl } from '@/components/gdrive/authControl';
import GdriveBanner from '@/components/gdrive/gdrive-banner/GdriveBanner';
import type { GdriveSession } from '@/services/gdrive';

interface GdriveReconnectBannerProps {
  session: GdriveSession;
  /** Whether the hour of Google's own token is already over. */
  expired: boolean;
  error: 'popup-blocked' | 'failed' | null;
  /** False beside another primary action, which a screen has one of. */
  primary: boolean;
}

/**
 * The fallback's token lasts an hour and only a click may open Google's popup
 * again, so the banner asks for one; saves wait meanwhile and go out after.
 */
const GdriveReconnectBanner: React.FC<GdriveReconnectBannerProps> = ({
  session,
  expired,
  error,
  primary,
}) => {
  const { t } = useI18n();

  return (
    <GdriveBanner
      message={t(
        error === 'popup-blocked'
          ? 'gdrive.banner.popupBlocked'
          : error === 'failed'
            ? 'gdrive.banner.reconnectFailed'
            : expired
              ? 'gdrive.banner.sessionEnded'
              : 'gdrive.banner.sessionEndsSoon'
      )}
    >
      <Button
        size="2"
        variant={primary ? 'solid' : 'outline'}
        color="gray"
        highContrast={primary}
        onClick={() => session.reconnect()}
        {...authControl}
      >
        {t('gdrive.banner.reconnect')}
      </Button>
    </GdriveBanner>
  );
};

export default GdriveReconnectBanner;

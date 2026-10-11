import { Button } from '@radix-ui/themes';
import { Download, RotateCw, SearchCheck } from 'lucide-react';
import { useState } from 'react';

import { useI18n } from '@/atoms/modules/locale';
import GdriveBanner from '@/components/gdrive/gdrive-banner/GdriveBanner';
import type { PlainMessageKey } from '@/i18n/translate';
import type { GdriveSession } from '@/services/gdrive';
import { settleReported } from '@/utils/reportError';

interface GdriveConflictBannerProps {
  session: GdriveSession;
  /** readonly only for edit access lost while editing, never for a file that opened read-only. */
  state: 'conflict' | 'unconfirmed' | 'deleted' | 'readonly';
}

const MESSAGES: Record<GdriveConflictBannerProps['state'], PlainMessageKey> = {
  conflict: 'gdrive.banner.conflict',
  unconfirmed: 'gdrive.banner.unconfirmed',
  deleted: 'gdrive.banner.deleted',
  readonly: 'gdrive.banner.readonly',
};

/**
 * A stop nothing may save over: Download my changes keeps the edits, Reload
 * from Drive drops them, and after an unconfirmed save Check Drive looks
 * whether that save landed after all (the user's call, U12).
 */
const GdriveConflictBanner: React.FC<GdriveConflictBannerProps> = ({
  session,
  state,
}) => {
  const [checking, setChecking] = useState(false);
  const [reloading, setReloading] = useState(false);
  const { t } = useI18n();

  const handleCheck = () => {
    setChecking(true);
    void settleReported(session.checkDrive)().finally(() => setChecking(false));
  };

  const handleReload = () => {
    setReloading(true);
    void settleReported(session.reload)().finally(() => setReloading(false));
  };

  return (
    <GdriveBanner message={t(MESSAGES[state])}>
      {state === 'unconfirmed' ? (
        <Button
          size="2"
          variant="outline"
          color="gray"
          loading={checking}
          onClick={handleCheck}
        >
          <SearchCheck size={16} />
          {t('gdrive.banner.checkDrive')}
        </Button>
      ) : null}
      {state === 'deleted' ? null : (
        <Button
          size="2"
          variant="outline"
          color="red"
          loading={reloading}
          onClick={handleReload}
        >
          <RotateCw size={16} />
          {t('gdrive.banner.reloadFromDrive')}
        </Button>
      )}
      <Button
        size="2"
        color="gray"
        highContrast
        onClick={() => session.downloadChanges()}
      >
        <Download size={16} />
        {t('common.downloadMyChanges')}
      </Button>
    </GdriveBanner>
  );
};

export default GdriveConflictBanner;

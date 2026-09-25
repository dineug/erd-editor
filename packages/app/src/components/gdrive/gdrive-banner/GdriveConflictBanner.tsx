import { Button } from '@radix-ui/themes';
import { Download, RotateCw, SearchCheck } from 'lucide-react';
import { useState } from 'react';

import GdriveBanner from '@/components/gdrive/gdrive-banner/GdriveBanner';
import type { GdriveSession } from '@/services/gdrive';
import { settleReported } from '@/utils/reportError';

interface GdriveConflictBannerProps {
  session: GdriveSession;
  /** readonly only for edit access lost while editing, never for a file that opened read-only. */
  state: 'conflict' | 'unconfirmed' | 'deleted' | 'readonly';
}

const MESSAGES = {
  conflict:
    'This file changed in Google Drive, so saving stopped. Your changes are still here.',
  unconfirmed:
    "Couldn't confirm the last save, so saving stopped. Your changes are still here.",
  deleted:
    'This file was deleted or moved to the trash in Google Drive, so saving stopped.',
  readonly:
    "You can't edit this file in Google Drive anymore, so saving stopped. Your changes are still here.",
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

  const handleCheck = () => {
    setChecking(true);
    void settleReported(session.checkDrive)().finally(() => setChecking(false));
  };

  const handleReload = () => {
    setReloading(true);
    void settleReported(session.reload)().finally(() => setReloading(false));
  };

  return (
    <GdriveBanner message={MESSAGES[state]}>
      {state === 'unconfirmed' ? (
        <Button
          size="2"
          variant="outline"
          color="gray"
          loading={checking}
          onClick={handleCheck}
        >
          <SearchCheck size={16} />
          Check Drive
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
          Reload from Drive
        </Button>
      )}
      <Button
        size="2"
        color="gray"
        highContrast
        onClick={() => session.downloadChanges()}
      >
        <Download size={16} />
        Download my changes
      </Button>
    </GdriveBanner>
  );
};

export default GdriveConflictBanner;

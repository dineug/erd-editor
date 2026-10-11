import { AlertDialog, Button, Flex } from '@radix-ui/themes';
import { Download } from 'lucide-react';

import { useI18n } from '@/atoms/modules/locale';
import { authControl } from '@/components/gdrive/authControl';
import type { GdriveSession, LeaveRequest } from '@/services/gdrive';
import { settleReported } from '@/utils/reportError';

interface GdriveLeaveDialogProps {
  session: GdriveSession;
  request: LeaveRequest;
}

/** A switch or a sign-out whose save failed: stay, keep a copy, or let the changes go. */
const GdriveLeaveDialog: React.FC<GdriveLeaveDialogProps> = ({
  session,
  request,
}) => {
  const signingOut = request.reason === 'sign-out';
  const { t } = useI18n();

  return (
    <AlertDialog.Root
      open
      onOpenChange={open => {
        if (!open) session.stay();
      }}
    >
      <AlertDialog.Content style={{ maxWidth: 460 }}>
        <AlertDialog.Title>{t('gdrive.leave.title')}</AlertDialog.Title>
        <AlertDialog.Description size="2">
          {t(
            signingOut
              ? 'gdrive.leave.descriptionSignOut'
              : 'gdrive.leave.description'
          )}
        </AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end" wrap="wrap">
          <AlertDialog.Cancel>
            <Button size="2" variant="soft" color="gray">
              {t('gdrive.leave.stay')}
            </Button>
          </AlertDialog.Cancel>
          <Button
            size="2"
            variant="outline"
            color="red"
            onClick={() => void settleReported(session.leaveAnyway)()}
            {...(signingOut ? authControl : {})}
          >
            {t(
              signingOut
                ? 'gdrive.leave.signOutAnyway'
                : 'gdrive.leave.leaveAnyway'
            )}
          </Button>
          <Button
            size="2"
            color="gray"
            highContrast
            onClick={() => session.downloadChanges()}
          >
            <Download size={16} />
            {t('common.downloadMyChanges')}
          </Button>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
};

export default GdriveLeaveDialog;

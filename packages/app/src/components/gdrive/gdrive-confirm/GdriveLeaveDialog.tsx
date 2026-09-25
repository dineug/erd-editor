import { AlertDialog, Button, Flex } from '@radix-ui/themes';
import { Download } from 'lucide-react';

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

  return (
    <AlertDialog.Root
      open
      onOpenChange={open => {
        if (!open) session.stay();
      }}
    >
      <AlertDialog.Content style={{ maxWidth: 460 }}>
        <AlertDialog.Title>
          Your latest changes aren&apos;t saved
        </AlertDialog.Title>
        <AlertDialog.Description size="2">
          ERD Editor couldn&apos;t save them to Google Drive. Download them to
          keep a copy, or {signingOut ? 'sign out' : 'leave'} and lose them.
        </AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end" wrap="wrap">
          <AlertDialog.Cancel>
            <Button size="2" variant="soft" color="gray">
              Stay
            </Button>
          </AlertDialog.Cancel>
          <Button
            size="2"
            variant="outline"
            color="red"
            onClick={() => void settleReported(session.leaveAnyway)()}
            {...(signingOut ? authControl : {})}
          >
            {signingOut ? 'Sign out anyway' : 'Leave anyway'}
          </Button>
          <Button
            size="2"
            color="gray"
            highContrast
            onClick={() => session.downloadChanges()}
          >
            <Download size={16} />
            Download my changes
          </Button>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
};

export default GdriveLeaveDialog;

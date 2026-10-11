import { Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes';
import { useState } from 'react';

import { useI18n } from '@/atoms/modules/locale';
import type { I18n } from '@/i18n/translate';
import {
  type CreateRequest,
  type GdriveSession,
  toNewFileName,
} from '@/services/gdrive';
import { settleReported } from '@/utils/reportError';

interface GdriveCreateDialogProps {
  session: GdriveSession;
  request: CreateRequest;
}

/** Where the file goes; a folderId in the link could name someone else's folder, so it is said. */
function folderText({ folderId, folderName }: CreateRequest, { t }: I18n) {
  if (!folderId) return t('gdrive.create.inAppFolder');
  if (folderName === undefined) return t('gdrive.create.inFolderPending');
  if (folderName === null) return t('gdrive.create.inHiddenFolder');
  return t('gdrive.create.inFolder', { name: folderName });
}

/** Google Drive's New: a name, then the file, in the folder Drive sent or in the ERD Editor folder. */
const GdriveCreateDialog: React.FC<GdriveCreateDialogProps> = ({
  session,
  request,
}) => {
  const [name, setName] = useState('');
  const creating = request.status === 'creating';
  const i18n = useI18n();
  const { t } = i18n;
  // Named here, so a name left empty takes the reader's word for untitled.
  const fileName = toNewFileName(name, t('gdrive.create.untitled'));

  const create = (inAppFolder: boolean) => {
    void settleReported(session.confirmCreate)(fileName, inAppFolder);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    create(false);
  };

  return (
    <Dialog.Root
      open
      onOpenChange={open => {
        if (!open && !creating) session.cancelCreate();
      }}
    >
      <Dialog.Content style={{ maxWidth: 460 }}>
        <Dialog.Title>{t('gdrive.create.title')}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          {folderText(request, i18n)}
        </Dialog.Description>
        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="2">
            <TextField.Root
              value={name}
              placeholder={t('gdrive.create.untitled')}
              aria-label={t('gdrive.sidebar.fileName')}
              autoFocus
              disabled={creating}
              onChange={event => setName(event.target.value)}
            />
            <Text size="1" color="gray">
              {t('gdrive.create.savedAs', { name: fileName })}
            </Text>
            {request.status === 'folder-refused' ? (
              <Text size="2" color="red">
                {t('gdrive.create.folderRefused')}
              </Text>
            ) : request.status === 'failed' ? (
              <Text size="2" color="red">
                {t('gdrive.create.failed')}
              </Text>
            ) : null}
          </Flex>
          <Flex gap="3" mt="4" justify="end" wrap="wrap">
            <Dialog.Close>
              <Button
                type="button"
                size="2"
                variant="soft"
                color="gray"
                disabled={creating}
              >
                {t('common.cancel')}
              </Button>
            </Dialog.Close>
            {request.folderId ? (
              <Button
                type="button"
                size="2"
                variant="outline"
                color="gray"
                disabled={creating}
                onClick={() => create(true)}
              >
                {t('gdrive.create.createInAppFolder')}
              </Button>
            ) : null}
            <Button
              type="submit"
              size="2"
              color="gray"
              highContrast
              loading={creating}
            >
              {t('gdrive.create.create')}
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default GdriveCreateDialog;

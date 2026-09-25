import { Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes';
import { useState } from 'react';

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
function folderText({ folderId, folderName }: CreateRequest) {
  if (!folderId) return 'In My Drive';
  if (folderName === undefined) return 'In a folder…';
  if (folderName === null) return "In a folder ERD Editor can't see";
  return `In the folder “${folderName}”`;
}

/** Google Drive's New: a name, then the file, in the folder Drive sent or in My Drive. */
const GdriveCreateDialog: React.FC<GdriveCreateDialogProps> = ({
  session,
  request,
}) => {
  const [name, setName] = useState('');
  const creating = request.status === 'creating';

  const create = (inMyDrive: boolean) => {
    void settleReported(session.confirmCreate)(name, inMyDrive);
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
        <Dialog.Title>New file in Google Drive</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          {folderText(request)}
        </Dialog.Description>
        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="2">
            <TextField.Root
              value={name}
              placeholder="Untitled"
              aria-label="File name"
              autoFocus
              disabled={creating}
              onChange={event => setName(event.target.value)}
            />
            <Text size="1" color="gray">
              Saved as {toNewFileName(name)}
            </Text>
            {request.status === 'folder-refused' ? (
              <Text size="2" color="red">
                ERD Editor can&apos;t create files in this folder. Create it in
                My Drive instead?
              </Text>
            ) : request.status === 'failed' ? (
              <Text size="2" color="red">
                Couldn&apos;t create the file. Try again.
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
                Cancel
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
                Create in My Drive instead
              </Button>
            ) : null}
            <Button
              type="submit"
              size="2"
              color="gray"
              highContrast
              loading={creating}
            >
              Create
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default GdriveCreateDialog;

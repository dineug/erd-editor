import { ClipboardIcon, LightningBoltIcon } from '@radix-ui/react-icons';
import { Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes';
import { useRef, useState } from 'react';

import {
  useCollaborativeMap,
  useStartSession,
  useStopSession,
} from '@/atoms/modules/collaborative';
import { SchemaEntity } from '@/services/indexeddb/modules/schema';
import { copyToClipboard } from '@/utils/clipboard';

import * as styles from './SidebarCollaborative.styles';

interface SidebarCollaborativeProps {
  entity: Omit<SchemaEntity, 'value'>;
}

const SidebarCollaborative: React.FC<SidebarCollaborativeProps> = ({
  entity,
}) => {
  const collaborativeMap = useCollaborativeMap();
  const startSession = useStartSession();
  const stopSession = useStopSession();
  const collaborative = collaborativeMap[entity.id];
  const hasCollaborative = Boolean(collaborative);
  const [roomId, secretKey] = hasCollaborative ? collaborative : ['', ''];
  const link = `https://erd-editor.io/live/#${roomId},${secretKey}`;

  const [copyState, setCopyState] = useState(false);
  const timerId = useRef(-1);

  const handleCopyLink = () => {
    copyToClipboard(link).then(() => {
      setCopyState(true);
      clearTimeout(timerId.current);
      timerId.current = setTimeout(() => setCopyState(false), 1000);
    });
  };

  const handleStartSession = () => {
    startSession(entity.id);
  };

  const handleStopSession = () => {
    stopSession(entity.id);
  };

  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <div
          className="collaborative"
          css={styles.collaborative}
          data-active={hasCollaborative}
        >
          <LightningBoltIcon width="16" height="16" />
        </div>
      </Dialog.Trigger>

      <Dialog.Content style={{ maxWidth: 450 }}>
        <Dialog.Title>Collaborative editing</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          end to end encrypted.....
        </Dialog.Description>

        {hasCollaborative ? (
          <Flex direction="column" gap="3">
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                Nickname
              </Text>
              <TextField.Input placeholder="Your nickname" />
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                Link
              </Text>
              <TextField.Root css={styles.link} onClick={handleCopyLink}>
                <TextField.Input value={link} readOnly />
                <TextField.Slot pr="3">
                  <ClipboardIcon
                    color={copyState ? 'var(--accent-9)' : undefined}
                    width="16"
                    height="16"
                  />
                </TextField.Slot>
              </TextField.Root>
            </label>
          </Flex>
        ) : null}

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Close
            </Button>
          </Dialog.Close>
          {hasCollaborative ? (
            <Dialog.Close onClick={handleStopSession}>
              <Button variant="solid" color="red">
                Stop session
              </Button>
            </Dialog.Close>
          ) : (
            <Button variant="solid" onClick={handleStartSession}>
              Start session
            </Button>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default SidebarCollaborative;

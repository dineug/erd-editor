import { ClipboardIcon, LightningBoltIcon } from '@radix-ui/react-icons';
import {
  Badge,
  Button,
  Dialog,
  Flex,
  IconButton,
  Text,
  TextField,
} from '@radix-ui/themes';
import { useAtom } from 'jotai';
import { useId, useRef, useState } from 'react';

import {
  nicknameStorageAtom,
  useCollaborativeMap,
  useCollaborativeParticipants,
  useStartSession,
  useStopSession,
} from '@/atoms/modules/collaborative';
import {
  NICKNAME_MAX_LENGTH,
  participantName,
  Role,
} from '@/services/collaborative';
import { SchemaEntity } from '@/services/indexeddb/modules/schema';
import { copyToClipboard } from '@/utils/clipboard';

import * as styles from './SidebarCollaborative.styles';

interface SidebarCollaborativeProps {
  entity: Omit<SchemaEntity, 'value'>;
  /** Whether Tab reaches the trigger, which a running session keeps on screen. */
  tabStop: boolean;
}

const SidebarCollaborative: React.FC<SidebarCollaborativeProps> = ({
  entity,
  tabStop,
}) => {
  const collaborativeMap = useCollaborativeMap();
  const startSession = useStartSession();
  const stopSession = useStopSession();
  const participants = useCollaborativeParticipants(entity.id);
  const collaborative = collaborativeMap[entity.id];
  const hasCollaborative = Boolean(collaborative);
  const guestCount = hasCollaborative ? participants.length : 0;
  const [roomId, secretKey] = hasCollaborative ? collaborative : ['', ''];
  const link = `${location.origin}/live/#${roomId},${secretKey}`;

  const countId = useId();

  const [nickname, setNickname] = useAtom(nicknameStorageAtom);
  const [copyState, setCopyState] = useState(false);
  const timerId = useRef(-1);

  const handleCopyLink = () => {
    copyToClipboard(link).then(() => {
      setCopyState(true);
      clearTimeout(timerId.current);
      timerId.current = window.setTimeout(() => setCopyState(false), 1000);
    });
  };

  const handleStartSession = () => {
    startSession(entity.id);
  };

  const handleStopSession = () => {
    stopSession(entity.id);
  };

  const handleChangeNickname = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNickname(event.target.value);
  };

  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <IconButton
          className="collaborative"
          css={styles.collaborative}
          size="1"
          variant="ghost"
          color="gray"
          tabIndex={tabStop ? undefined : -1}
          aria-label={`Collaboration for ${entity.name}`}
          aria-describedby={guestCount ? countId : undefined}
          data-active={hasCollaborative}
        >
          <LightningBoltIcon width="16" height="16" />
          {guestCount ? (
            <span
              id={countId}
              css={styles.count}
              aria-label={`${guestCount} ${guestCount === 1 ? 'guest' : 'guests'} connected`}
            >
              {guestCount}
            </span>
          ) : null}
        </IconButton>
      </Dialog.Trigger>

      <Dialog.Content style={{ maxWidth: 450 }}>
        <Dialog.Title>
          Collaborative editing{' '}
          <Badge radius="full" color="orange">
            Experiment
          </Badge>
        </Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Peers connect directly over WebRTC and exchange messages using
          end-to-end encryption.
        </Dialog.Description>

        {hasCollaborative ? (
          <Flex direction="column" gap="3">
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                Nickname
              </Text>
              <TextField.Root
                placeholder="Your nickname"
                value={nickname}
                maxLength={NICKNAME_MAX_LENGTH}
                onChange={handleChangeNickname}
              />
            </label>
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                Link
              </Text>
              <TextField.Root
                css={styles.link}
                onClick={handleCopyLink}
                value={link}
                readOnly
              >
                <TextField.Slot pr="3">
                  <ClipboardIcon
                    color={copyState ? 'var(--accent-9)' : undefined}
                    width="16"
                    height="16"
                  />
                </TextField.Slot>
              </TextField.Root>
            </label>
            <div>
              <Text as="div" size="2" mb="1" weight="bold">
                Participants
              </Text>
              <ul css={styles.participants} aria-label="Participants">
                <li css={styles.participant}>
                  <Text size="2" css={styles.name}>
                    {participantName({ role: Role.host, nickname })}
                  </Text>
                  <Text size="2" color="gray">
                    (you)
                  </Text>
                  <Badge color="gray" radius="full">
                    Host
                  </Badge>
                </li>
                {participants.map(participant => (
                  <li key={participant.peerId} css={styles.participant}>
                    <Text size="2" css={styles.name}>
                      {participantName(participant)}
                    </Text>
                  </li>
                ))}
              </ul>
              {participants.length ? null : (
                <Text as="div" size="1" color="gray" mt="1">
                  No one else has joined yet.
                </Text>
              )}
            </div>
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

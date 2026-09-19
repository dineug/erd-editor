import {
  Badge,
  Card,
  Flex,
  IconButton,
  Text,
  TextField,
} from '@radix-ui/themes';
import { useAtom } from 'jotai';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import { useId, useState } from 'react';

import { nicknameStorageAtom } from '@/atoms/modules/collaborative';
import {
  NICKNAME_MAX_LENGTH,
  Participant,
  participantName,
  Role,
} from '@/services/collaborative';

import * as styles from './LiveParticipants.styles';

// Collapsed from the start where the open panel would crowd the canvas.
const startsOpen = () => !globalThis.matchMedia?.(styles.narrowQuery).matches;

interface LiveParticipantsProps {
  participants: Participant[];
  selfId: string;
}

/**
 * The guest's own corner of the session: its nickname and who else is in. It
 * sits bottom-left, the one corner the editor leaves free of its own controls.
 */
const LiveParticipants: React.FC<LiveParticipantsProps> = ({
  participants,
  selfId,
}) => {
  const [nickname, setNickname] = useAtom(nicknameStorageAtom);
  const [open, setOpen] = useState(startsOpen);
  const bodyId = useId();

  const handleToggle = () => {
    setOpen(value => !value);
  };

  const handleChangeNickname = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNickname(event.target.value);
  };

  return (
    <Card css={styles.root} size="1" role="region" aria-label="Live session">
      <Flex align="center" gap="2">
        <Users size={16} />
        <Text size="2" weight="bold" css={styles.title}>
          {participants.length} in session
        </Text>
        <IconButton
          size="1"
          variant="ghost"
          color="gray"
          aria-label={open ? 'Hide participants' : 'Show participants'}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={handleToggle}
        >
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </IconButton>
      </Flex>

      {open ? (
        <Flex id={bodyId} direction="column" gap="2" mt="2">
          <TextField.Root
            size="1"
            placeholder="Your nickname"
            aria-label="Your nickname"
            value={nickname}
            maxLength={NICKNAME_MAX_LENGTH}
            onChange={handleChangeNickname}
          />
          <ul css={styles.list} aria-label="Participants">
            {participants.map(participant => (
              <li key={participant.peerId} css={styles.item}>
                <Text size="1" css={styles.name}>
                  {participantName(participant)}
                </Text>
                {participant.peerId === selfId ? (
                  <Text size="1" color="gray">
                    (you)
                  </Text>
                ) : null}
                {participant.role === Role.host ? (
                  <Badge size="1" color="gray" radius="full">
                    Host
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        </Flex>
      ) : null}
    </Card>
  );
};

export default LiveParticipants;

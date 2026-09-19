import { Button, Flex, Text } from '@radix-ui/themes';
import { RotateCw } from 'lucide-react';
import { useRouteError } from 'react-router';

import {
  HostStopSessionError,
  InvalidHashError,
  NotFoundHostError,
} from '@/utils/errors';

import * as styles from './LiveCollaborativeError.styles';

interface LiveCollaborativeErrorProps {}

const LiveCollaborativeError: React.FC<LiveCollaborativeErrorProps> = () => {
  const error = useRouteError();

  const isInvalidHashError = error instanceof InvalidHashError;
  const isNotFoundHostError = error instanceof NotFoundHostError;
  const isHostStopSessionError = error instanceof HostStopSessionError;

  const handleRefresh = () => {
    location.reload();
  };

  return (
    <Flex css={styles.root} direction="column" align="center" justify="center">
      {isInvalidHashError ? (
        <Text size="6">Invalid shared token.</Text>
      ) : isNotFoundHostError ? (
        <>
          <Text size="6">Host not found.</Text>
          <Button
            css={styles.button}
            color="gray"
            highContrast
            onClick={handleRefresh}
          >
            <RotateCw size={16} /> Refresh
          </Button>
        </>
      ) : isHostStopSessionError ? (
        <Text size="6">Host stopped the session.</Text>
      ) : (
        <Text size="6">Something went wrong.</Text>
      )}
    </Flex>
  );
};

export default LiveCollaborativeError;

import { Button, Flex, Text } from '@radix-ui/themes';
import { RotateCw } from 'lucide-react';
import { useRouteError } from 'react-router';

import { useI18n } from '@/atoms/modules/locale';
import {
  HostStopSessionError,
  InvalidHashError,
  NotFoundHostError,
} from '@/utils/errors';

import * as styles from './LiveCollaborativeError.styles';

interface LiveCollaborativeErrorProps {}

const LiveCollaborativeError: React.FC<LiveCollaborativeErrorProps> = () => {
  const error = useRouteError();
  const { t } = useI18n();

  const isInvalidHashError = error instanceof InvalidHashError;
  const isNotFoundHostError = error instanceof NotFoundHostError;
  const isHostStopSessionError = error instanceof HostStopSessionError;

  const handleRefresh = () => {
    location.reload();
  };

  return (
    <Flex css={styles.root} direction="column" align="center" justify="center">
      {isInvalidHashError ? (
        <Text size="6">{t('live.invalidToken')}</Text>
      ) : isNotFoundHostError ? (
        <>
          <Text size="6">{t('live.hostNotFound')}</Text>
          <Button
            css={styles.button}
            color="gray"
            highContrast
            onClick={handleRefresh}
          >
            <RotateCw size={16} /> {t('live.refresh')}
          </Button>
        </>
      ) : isHostStopSessionError ? (
        <Text size="6">{t('live.hostStopped')}</Text>
      ) : (
        <Text size="6">{t('live.somethingWentWrong')}</Text>
      )}
    </Flex>
  );
};

export default LiveCollaborativeError;

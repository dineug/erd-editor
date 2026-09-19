import { Button, Card, Flex, IconButton, Text } from '@radix-ui/themes';
import { RefreshCw, X } from 'lucide-react';

import {
  useApplyAppUpdate,
  useAppUpdateStatus,
  useDismissAppUpdate,
} from '@/atoms/modules/app-update';

import * as styles from './AppUpdatePrompt.styles';

interface AppUpdatePromptProps {}

const AppUpdatePrompt: React.FC<AppUpdatePromptProps> = () => {
  const status = useAppUpdateStatus();
  const applyUpdate = useApplyAppUpdate();
  const dismiss = useDismissAppUpdate();

  if (!status) return null;

  return (
    <Card css={styles.root} role="status">
      <Flex align="center" gap="3">
        <Text size="2">
          {status === 'updatedElsewhere'
            ? 'The app was updated in another tab — reload to finish.'
            : 'A new version of erd-editor is available.'}
        </Text>
        <Button
          size="1"
          color="gray"
          highContrast
          loading={status === 'updating'}
          onClick={() => applyUpdate()}
        >
          <RefreshCw size={16} />
          Reload
        </Button>
        <IconButton
          size="1"
          variant="ghost"
          color="gray"
          aria-label="Dismiss"
          onClick={() => dismiss()}
        >
          <X size={16} />
        </IconButton>
      </Flex>
    </Card>
  );
};

export default AppUpdatePrompt;

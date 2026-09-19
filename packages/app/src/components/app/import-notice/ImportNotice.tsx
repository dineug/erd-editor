import { Callout, Flex, IconButton } from '@radix-ui/themes';
import { CircleCheck, TriangleAlert, X } from 'lucide-react';
import { useEffect } from 'react';

import {
  useDismissImportNotice,
  useImportNotice,
} from '@/atoms/modules/schema-import';

import * as styles from './ImportNotice.styles';

const AUTO_DISMISS = 5000;

interface ImportNoticeProps {}

const ImportNotice: React.FC<ImportNoticeProps> = () => {
  const notice = useImportNotice();
  const dismiss = useDismissImportNotice();
  const key = notice?.key;

  useEffect(() => {
    if (key === undefined) return;

    const timer = window.setTimeout(dismiss, AUTO_DISMISS);
    return () => window.clearTimeout(timer);
  }, [key, dismiss]);

  if (!notice) return null;

  return (
    <Callout.Root
      css={styles.root}
      role="status"
      size="1"
      variant="surface"
      color={notice.tone === 'success' ? undefined : 'amber'}
    >
      <Callout.Icon>
        {notice.tone === 'success' ? (
          <CircleCheck size={16} />
        ) : (
          <TriangleAlert size={16} />
        )}
      </Callout.Icon>
      <Flex align="center" gap="3">
        <Callout.Text>{notice.message}</Callout.Text>
        <IconButton
          size="1"
          variant="ghost"
          color="gray"
          aria-label="Dismiss"
          onClick={dismiss}
        >
          <X size={14} />
        </IconButton>
      </Flex>
    </Callout.Root>
  );
};

export default ImportNotice;

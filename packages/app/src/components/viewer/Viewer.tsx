import { Button, Flex, Link, Text } from '@radix-ui/themes';
import { BookOpen, FileUp, Plus } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';

import {
  useOpenImportDialog,
  useOpenSample,
} from '@/atoms/modules/schema-import';
import { useSchemaEntity, useStartAddingSchema } from '@/atoms/modules/sidebar';

import * as styles from './Viewer.styles';

interface ViewerProps {}

const LazyEditor = lazy(() => import('@/components/viewer/editor/Editor'));

/** The GitHub mark, drawn inline because lucide-react 1.x ships no brand icons. */
const GitHubMark: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path
      fill="currentColor"
      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
    />
  </svg>
);

const EmptyViewer: React.FC = () => {
  const startAddingSchema = useStartAddingSchema();
  const openImportDialog = useOpenImportDialog();
  const openSample = useOpenSample();
  const [openingSample, setOpeningSample] = useState(false);

  const handleOpenSample = () => {
    setOpeningSample(true);
    openSample().finally(() => setOpeningSample(false));
  };

  return (
    <Flex css={styles.empty} direction="column" align="center" gap="5">
      <Flex direction="column" align="center" gap="1">
        <Text size="5" weight="medium">
          No schema open
        </Text>
        <Text size="2" color="gray">
          Pick one from the sidebar, or start one here. You can also drop files
          anywhere to import them.
        </Text>
      </Flex>
      <Flex css={styles.actions} gap="2" justify="center" wrap="wrap">
        <Button
          size="2"
          color="gray"
          highContrast
          onClick={() => startAddingSchema()}
        >
          <Plus size={16} />
          New schema
        </Button>
        <Button
          size="2"
          variant="outline"
          color="gray"
          onClick={() => openImportDialog()}
        >
          <FileUp size={16} />
          Import files
        </Button>
        <Button
          size="2"
          variant="outline"
          color="gray"
          loading={openingSample}
          onClick={handleOpenSample}
        >
          <BookOpen size={16} />
          Open sample
        </Button>
      </Flex>
      <Flex gap="4" align="center">
        <Link
          href="https://docs.erd-editor.io/docs/category/guides"
          target="_blank"
          underline="hover"
          size="2"
          color="gray"
        >
          Editing Guide
        </Link>
        <span css={styles.separator} aria-hidden="true">
          ·
        </span>
        <Link
          href="https://github.com/dineug/erd-editor"
          target="_blank"
          underline="hover"
          size="2"
          color="gray"
        >
          <Flex align="center" gap="1">
            <GitHubMark />
            GitHub
          </Flex>
        </Link>
      </Flex>
    </Flex>
  );
};

const Viewer: React.FC<ViewerProps> = () => {
  const value = useSchemaEntity();
  const loading = <Text size="4">Loading...</Text>;

  return (
    <Flex css={styles.root} direction="column" align="center" justify="center">
      {value.state === 'hasError' ? (
        <EmptyViewer />
      ) : value.state === 'loading' ? (
        loading
      ) : (
        <Suspense fallback={loading}>
          <LazyEditor entity={value.data} />
        </Suspense>
      )}
    </Flex>
  );
};

export default Viewer;

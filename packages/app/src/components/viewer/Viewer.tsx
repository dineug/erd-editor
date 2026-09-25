import { Button, Flex, Text } from '@radix-ui/themes';
import { BookOpen, FileUp, Plus } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';

import {
  useOpenImportDialog,
  useOpenSample,
} from '@/atoms/modules/schema-import';
import { useSchemaEntity, useStartAddingSchema } from '@/atoms/modules/sidebar';
import ResourceLinks from '@/components/resource-links/ResourceLinks';

import * as styles from './Viewer.styles';

interface ViewerProps {}

const LazyEditor = lazy(() => import('@/components/viewer/editor/Editor'));

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
      <ResourceLinks />
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

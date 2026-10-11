import { Button, Flex, Text } from '@radix-ui/themes';
import { BookOpen, FileUp, Plus } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';

import { useI18n } from '@/atoms/modules/locale';
import {
  useImportingFiles,
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
  const importingFiles = useImportingFiles();
  const openSample = useOpenSample();
  const [openingSample, setOpeningSample] = useState(false);
  const { t } = useI18n();

  const handleOpenSample = () => {
    setOpeningSample(true);
    openSample().finally(() => setOpeningSample(false));
  };

  return (
    <Flex css={styles.empty} direction="column" align="center" gap="5">
      <Flex direction="column" align="center" gap="1">
        <Text size="5" weight="medium">
          {t('viewer.noSchemaOpen')}
        </Text>
        <Text size="2" color="gray">
          {t('viewer.emptyHint')}
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
          {t('sidebar.newSchema')}
        </Button>
        <Button
          size="2"
          variant="outline"
          color="gray"
          loading={importingFiles}
          onClick={() => openImportDialog()}
        >
          <FileUp size={16} />
          {t('common.importFiles')}
        </Button>
        <Button
          size="2"
          variant="outline"
          color="gray"
          loading={openingSample}
          onClick={handleOpenSample}
        >
          <BookOpen size={16} />
          {t('viewer.openSample')}
        </Button>
      </Flex>
      <ResourceLinks />
    </Flex>
  );
};

const Viewer: React.FC<ViewerProps> = () => {
  const value = useSchemaEntity();
  const { t } = useI18n();
  const loading = <Text size="4">{t('common.loading')}</Text>;

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

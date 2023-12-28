import { Flex, Text } from '@radix-ui/themes';
import { lazy, Suspense } from 'react';

import { useSchemaEntity } from '@/store/modules/sidebar';

import * as styles from './Viewer.styles';

interface ViewerProps {}

const EditorLazy = lazy(() => import('@/components/viewer/editor/Editor'));

const Viewer: React.FC<ViewerProps> = () => {
  const value = useSchemaEntity();
  const loading = <Text size="4">Loading...</Text>;

  return (
    <Flex css={styles.root}>
      {value.state === 'hasError' ? (
        <Text size="4">Please choose Schema</Text>
      ) : value.state === 'loading' ? (
        loading
      ) : (
        <Suspense fallback={loading}>
          <EditorLazy entity={value.data} />
        </Suspense>
      )}
    </Flex>
  );
};

export default Viewer;

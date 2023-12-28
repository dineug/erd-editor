import { Flex, Link, Text } from '@radix-ui/themes';
import { lazy, Suspense } from 'react';

import { useSchemaEntity } from '@/store/modules/sidebar';

import * as styles from './Viewer.styles';

interface ViewerProps {}

const EditorLazy = lazy(() => import('@/components/viewer/editor/Editor'));

const Viewer: React.FC<ViewerProps> = () => {
  const value = useSchemaEntity();
  const loading = <Text size="4">Loading...</Text>;

  return (
    <Flex css={styles.root} direction="column" align="center" justify="center">
      {value.state === 'hasError' ? (
        <>
          <Text size="4">Select or create a schema.</Text>
          <Link
            href="https://docs.erd-editor.io/docs/category/guides"
            target="_blank"
          >
            Editing Guide
          </Link>
        </>
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

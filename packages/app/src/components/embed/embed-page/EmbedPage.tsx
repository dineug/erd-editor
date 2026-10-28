import { Global } from '@emotion/react';
import { useLayoutEffect, useSyncExternalStore } from 'react';

import EmbedFrame from '@/components/embed/embed-frame/EmbedFrame';
import { embedAppearance, type EmbedOptions } from '@/utils/embedOptions';
import {
  applyDocumentAppearance,
  isSystemDark,
  watchSystemDark,
} from '@/utils/theme';

import * as styles from './EmbedPage.styles';

interface EmbedPageProps {
  options: EmbedOptions;
}

/**
 * The embedded viewer's whole page, outside Root: the root element takes the
 * look the URL's theme or the system gives it, as the pre-paint script did,
 * while its lang, its dir and the title stay as index.html has them.
 */
const EmbedPage: React.FC<EmbedPageProps> = ({ options }) => {
  const systemDark = useSyncExternalStore(watchSystemDark, isSystemDark);
  const appearance = embedAppearance(options.theme, systemDark);

  useLayoutEffect(() => {
    applyDocumentAppearance(document.documentElement, appearance);
  }, [appearance]);

  return (
    <>
      <Global styles={styles.global} />
      <div css={styles.page}>
        <EmbedFrame options={options} appearance={appearance} />
      </div>
    </>
  );
};

export default EmbedPage;

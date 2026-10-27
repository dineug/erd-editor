import '@dineug/erd-editor/erd-viewer.js';

import { useLayoutEffect, useRef } from 'react';

import { applyEmbedOptions, type EmbedOptions } from '@/utils/embedOptions';
import { toGithubRawUrl } from '@/utils/githubRawUrl';

import * as styles from './EmbedViewer.styles';

interface EmbedViewerProps {
  options: EmbedOptions;
}

/**
 * Creates the viewer with every option and its src set before it joins the
 * page, so its first fetch and first draw take them. Its loading and error
 * notices are all the page shows; no listener reports its error event.
 */
const EmbedViewer: React.FC<EmbedViewerProps> = ({ options }) => {
  const scopeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const $scope = scopeRef.current;
    if (!$scope) return;

    const viewer = document.createElement('erd-viewer');
    applyEmbedOptions(viewer, options);
    viewer.src = toGithubRawUrl(options.src);
    $scope.appendChild(viewer);

    return () => {
      $scope.removeChild(viewer);
      viewer.destroy();
    };
  }, [options]);

  return <div css={styles.scope} ref={scopeRef} />;
};

export default EmbedViewer;

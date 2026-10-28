import { useMemo } from 'react';
import { useLocation } from 'react-router';

import EmbedBuilder from '@/components/embed/embed-builder/EmbedBuilder';
import EmbedPage from '@/components/embed/embed-page/EmbedPage';
import { parseEmbedParams } from '@/utils/embedOptions';
import { isEmbedViewerUrl } from '@/utils/embedPath';

/**
 * The lazy page of /embed: the document its src names, in a viewer filling the
 * page, or without one the builder of that URL and its iframe.
 */
const EmbedRoute: React.FC = () => {
  const location = useLocation();
  const options = useMemo(
    () => parseEmbedParams(location.search),
    [location.search]
  );

  if (!isEmbedViewerUrl(location)) return <EmbedBuilder />;
  return <EmbedPage options={options} />;
};

export default EmbedRoute;

import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router';

import EmbedPage from '@/components/embed/embed-page/EmbedPage';
import { parseEmbedParams } from '@/utils/embedOptions';
import { isEmbedViewerUrl } from '@/utils/embedPath';

/** The lazy page of /embed: the document its src names, in a viewer filling the page. */
const EmbedRoute: React.FC = () => {
  const location = useLocation();
  const options = useMemo(
    () => parseEmbedParams(location.search),
    [location.search]
  );

  if (!isEmbedViewerUrl(location)) return <Navigate to="/" replace />;
  return <EmbedPage options={options} />;
};

export default EmbedRoute;

import { Outlet, useLocation } from 'react-router';

import Root from '@/routes/root/Root';
import { isEmbedViewerUrl } from '@/utils/embedPath';

/**
 * The shell of /embed: an embedded viewer renders outside Root, so none of the
 * app's chrome, prompts and stored preferences reach it, whatever Root gains,
 * while the page without a src is one of the app's own under Root.
 */
const EmbedShell: React.FC = () => {
  const location = useLocation();
  return isEmbedViewerUrl(location) ? <Outlet /> : <Root />;
};

export default EmbedShell;

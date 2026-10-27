import type { ResolvedAppearance } from '@/utils/theme';

import * as styles from './SiteLink.styles';

const SITE_URL = 'https://erd-editor.io';

interface SiteLinkProps {
  appearance: ResolvedAppearance;
}

/**
 * The site's name over the viewer, opening the site in a new tab. It names the
 * site as written, untranslated, in the look of the viewer beneath it, which
 * on the builder's page may differ from the app's own.
 */
const SiteLink: React.FC<SiteLinkProps> = ({ appearance }) => (
  <a
    css={styles.link}
    className={`${appearance}-theme`}
    href={SITE_URL}
    target="_blank"
    rel="noopener"
    referrerPolicy="no-referrer"
  >
    erd-editor.io
  </a>
);

export default SiteLink;

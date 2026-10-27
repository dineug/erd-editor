import EmbedViewer from '@/components/embed/embed-viewer/EmbedViewer';
import SiteLink from '@/components/embed/site-link/SiteLink';
import type { EmbedOptions } from '@/utils/embedOptions';
import type { ResolvedAppearance } from '@/utils/theme';

import * as styles from './EmbedFrame.styles';

interface EmbedFrameProps {
  options: EmbedOptions;
  appearance: ResolvedAppearance;
}

/** A viewer filling its box, with the site's link over its lower right corner. */
const EmbedFrame: React.FC<EmbedFrameProps> = ({ options, appearance }) => (
  <div css={styles.frame}>
    <EmbedViewer options={options} />
    <SiteLink appearance={appearance} />
  </div>
);

export default EmbedFrame;

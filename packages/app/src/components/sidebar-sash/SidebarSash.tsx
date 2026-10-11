import { Tooltip } from '@radix-ui/themes';
import { useAtom } from 'jotai';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useI18n } from '@/atoms/modules/locale';
import { sidebarSashAtom } from '@/atoms/modules/sidebar-sash';

import * as styles from './SidebarSash.styles';

interface SidebarSashProps {}

const SidebarSash: React.FC<SidebarSashProps> = () => {
  const [sashState, setSashState] = useAtom(sidebarSashAtom);
  const { t, dir } = useI18n();
  const label = t(
    sashState.open ? 'common.closeSidebar' : 'common.openSidebar'
  );
  // The chevron points the way the sidebar goes, which mirrors right to left.
  const pointsLeft = sashState.open === (dir === 'ltr');

  const handleToggleSash = () => {
    setSashState(draft => {
      draft.open = !draft.open;
    });
  };

  return (
    <Tooltip
      content={label}
      side={dir === 'rtl' ? 'left' : 'right'}
      sideOffset={20}
    >
      <button
        css={styles.sash(sashState.open)}
        type="button"
        aria-label={label}
        aria-expanded={sashState.open}
        onClick={handleToggleSash}
      >
        <span css={styles.icon}>
          {pointsLeft ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>
    </Tooltip>
  );
};

export default SidebarSash;

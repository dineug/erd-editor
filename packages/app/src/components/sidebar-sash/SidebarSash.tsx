import { Tooltip } from '@radix-ui/themes';
import { useAtom } from 'jotai';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { sidebarSashAtom } from '@/atoms/modules/sidebar-sash';

import * as styles from './SidebarSash.styles';

interface SidebarSashProps {}

const SidebarSash: React.FC<SidebarSashProps> = () => {
  const [sashState, setSashState] = useAtom(sidebarSashAtom);
  const label = sashState.open ? 'Close sidebar' : 'Open sidebar';

  const handleToggleSash = () => {
    setSashState(draft => {
      draft.open = !draft.open;
    });
  };

  return (
    <Tooltip content={label} side="right" sideOffset={20}>
      <button
        css={styles.sash(sashState.open)}
        type="button"
        aria-label={label}
        aria-expanded={sashState.open}
        onClick={handleToggleSash}
      >
        <span css={styles.icon}>
          {sashState.open ? (
            <ChevronLeft size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </span>
      </button>
    </Tooltip>
  );
};

export default SidebarSash;

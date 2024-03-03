import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { IconButton, Tooltip } from '@radix-ui/themes';
import { useAtom } from 'jotai';

import { sidebarSashAtom } from '@/atoms/modules/sidebar-sash';

import * as styles from './SidebarSash.styles';

interface SidebarSashProps {}

const SidebarSash: React.FC<SidebarSashProps> = () => {
  const [sashState, setSashState] = useAtom(sidebarSashAtom);

  const handleToggleSash = () => {
    setSashState(draft => {
      draft.open = !draft.open;
    });
  };

  return (
    <Tooltip
      content={sashState.open ? 'Close sidebar' : 'Open sidebar'}
      side="right"
      sideOffset={20}
    >
      <div css={styles.sash(sashState.open)} onClick={handleToggleSash}>
        <IconButton css={styles.icon(sashState.open)} variant="ghost" size="1">
          {sashState.open ? (
            <ChevronLeftIcon width={16} height={16} />
          ) : (
            <ChevronRightIcon width={16} height={16} />
          )}
        </IconButton>
      </div>
    </Tooltip>
  );
};

export default SidebarSash;

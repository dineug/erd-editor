import { atomWithStorage } from 'jotai/utils';
import { withImmer } from 'jotai-immer';

type SidebarSashState = {
  open: boolean;
};

const sidebarSashStorageAtom = atomWithStorage<SidebarSashState>(
  '@sidebarSash',
  {
    open: true,
  }
);

export const sidebarSashAtom = withImmer(sidebarSashStorageAtom);

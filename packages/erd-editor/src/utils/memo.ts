import { Show } from '@/constants/schema';
import type { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';

/** Whether the document shows its memos, which Show.hideMemo hides while set, as View Option's Memos does. */
export const isMemoShown = ({ settings }: RootState) =>
  !bHas(settings.show, Show.hideMemo);

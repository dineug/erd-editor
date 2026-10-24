import { NameViewMode } from '@/constants/schema';
import type { PlainMessageKey } from '@/i18n/translate';
import type { ValuesType } from '@/internal-types';

type NameViewOption = {
  labelKey: PlainMessageKey;
  value: ValuesType<typeof NameViewMode>;
};

/** The three name views, by the name a reader picks each one by. */
export const nameViewOptions: ReadonlyArray<NameViewOption> = [
  {
    labelKey: 'common.physicalNames',
    value: NameViewMode.physical,
  },
  {
    labelKey: 'common.logicalNames',
    value: NameViewMode.logical,
  },
  {
    labelKey: 'common.bothNames',
    value: NameViewMode.both,
  },
];

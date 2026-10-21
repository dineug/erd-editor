import { isLogicalNameView } from '@/engine/modules/editor/utils/nameView';
import type { RootState } from '@/engine/state';
import type { PlainMessageKey } from '@/i18n/translate';

/** What a logical name cell shows, dimmed, while its logical name is blank. */
export type BlankLogicalName = {
  /** The name drawn in the logical name's place, '' while there is none to draw. */
  standIn: string;
  /** The placeholder shown while there is no stand-in. */
  key: PlainMessageKey;
};

/**
 * The logical view sets the logical name cell in the name's place, so a blank
 * one shows the name, or the name's own placeholder while that is blank too.
 * The view of both shows the logical name's placeholder beside the name.
 *
 * @example
 * const { standIn, key } = blankLogicalName(settings, table.name, 'common.placeholder.table');
 */
export function blankLogicalName(
  settings: Pick<RootState['settings'], 'nameViewMode'>,
  name: string,
  nameKey: PlainMessageKey
): BlankLogicalName {
  if (!isLogicalNameView(settings)) {
    return { standIn: '', key: 'common.placeholder.logicalName' };
  }

  return { standIn: name.trim() ? name : '', key: nameKey };
}

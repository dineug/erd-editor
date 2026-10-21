import { AppContext } from '@/components/appContext';
import { NameViewMode } from '@/constants/schema';
import { toNameViewModeAction } from '@/engine/modules/settings/atom.actions';
import { sourceI18n } from '@/i18n/source';
import type { I18n, PlainMessageKey } from '@/i18n/translate';
import type { ValuesType } from '@/internal-types';

type Menu = {
  labelKey: PlainMessageKey;
  value: ValuesType<typeof NameViewMode>;
};

/** The three name views, by the name a reader picks each one by. */
export const menus: ReadonlyArray<Menu> = [
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

/**
 * The Name View rows, the view in force checked. A pick switches the reader's
 * own view, and the document's once its lock is off in an editor that is not
 * readonly.
 */
export function createNameViewMenus(
  { store }: AppContext,
  i18n: Pick<I18n, 't'> = sourceI18n
) {
  const { settings } = store.state;

  return menus.map(menu => ({
    checked: menu.value === settings.nameViewMode,
    name: i18n.t(menu.labelKey),
    onClick: () => {
      store.dispatch(
        toNameViewModeAction(store.state, menu.value, store.getReadonly())
      );
    },
  }));
}

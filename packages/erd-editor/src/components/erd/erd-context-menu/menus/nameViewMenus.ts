import { AppContext } from '@/components/appContext';
import { nameViewOptions } from '@/components/erd/nameViewOptions';
import { toNameViewModeAction } from '@/engine/modules/settings/atom.actions';
import { sourceI18n } from '@/i18n/source';
import type { I18n } from '@/i18n/translate';

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

  return nameViewOptions.map(menu => ({
    checked: menu.value === settings.nameViewMode,
    name: i18n.t(menu.labelKey),
    onClick: () => {
      store.dispatch(
        toNameViewModeAction(store.state, menu.value, store.getReadonly())
      );
    },
  }));
}

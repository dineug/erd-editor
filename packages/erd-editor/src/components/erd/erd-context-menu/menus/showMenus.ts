import { AppContext } from '@/components/appContext';
import { Show } from '@/constants/schema';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import { sourceI18n } from '@/i18n/source';
import type { I18n, PlainMessageKey } from '@/i18n/translate';
import { bHas } from '@/utils/bit';

type Menu = {
  labelKey: PlainMessageKey;
  show: number;
  /** A bit that hides what the menu shows, so the menu is checked while it is off. */
  hides?: boolean;
};

const menus: Menu[] = [
  {
    labelKey: 'contextMenu.show.tableComment',
    show: Show.tableComment,
  },
  {
    labelKey: 'contextMenu.show.columnComment',
    show: Show.columnComment,
  },
  {
    labelKey: 'common.column.dataType',
    show: Show.columnDataType,
  },
  {
    labelKey: 'common.column.default',
    show: Show.columnDefault,
  },
  {
    labelKey: 'common.column.notNull',
    show: Show.columnNotNull,
  },
  {
    labelKey: 'common.column.unique',
    show: Show.columnUnique,
  },
  {
    labelKey: 'contextMenu.show.alternateKey',
    show: Show.columnAlternateKey,
  },
  {
    labelKey: 'common.column.autoIncrement',
    show: Show.columnAutoIncrement,
  },
  {
    labelKey: 'common.relationship',
    show: Show.relationship,
  },
  {
    labelKey: 'contextMenu.show.referentialActions',
    show: Show.hideReferentialAction,
    hides: true,
  },
];

/** The View Option rows, each named in the reader's language and checked while it shows. */
export function createShowMenus(
  { store }: AppContext,
  i18n: Pick<I18n, 't'> = sourceI18n
) {
  const { settings } = store.state;

  return menus.map(menu => {
    const checked = bHas(settings.show, menu.show) !== Boolean(menu.hides);

    return {
      checked,
      name: i18n.t(menu.labelKey),
      onClick: () => {
        store.dispatch(
          changeShowAction({
            show: menu.show,
            value: menu.hides ? checked : !checked,
          })
        );
      },
    };
  });
}

import { AppContext } from '@/components/appContext';
import { NameCase } from '@/constants/schema';
import { changeTableNameCaseAction } from '@/engine/modules/settings/atom.actions';
import type { PlainMessageKey } from '@/i18n/translate';

type Menu = {
  name: string;
  labelKey?: PlainMessageKey;
  value: number;
};

export const menus: Menu[] = [
  {
    name: 'Pascal',
    value: NameCase.pascalCase,
  },
  {
    name: 'Camel',
    value: NameCase.camelCase,
  },
  {
    name: 'Snake',
    value: NameCase.snakeCase,
  },
  {
    name: 'None',
    labelKey: 'common.none',
    value: NameCase.none,
  },
];

export function createTableNameCaseMenus({ store }: AppContext) {
  const { settings } = store.state;

  return menus.map(menu => {
    const checked = menu.value === settings.tableNameCase;

    return {
      checked,
      name: menu.name,
      labelKey: menu.labelKey,
      onClick: () => {
        store.dispatch(
          changeTableNameCaseAction({
            value: menu.value,
          })
        );
      },
    };
  });
}

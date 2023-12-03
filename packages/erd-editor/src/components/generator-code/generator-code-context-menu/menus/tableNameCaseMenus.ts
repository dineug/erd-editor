import { AppContext } from '@/components/appContext';
import { NameCase } from '@/constants/schema';
import { changeTableNameCaseAction } from '@/engine/modules/settings/atom.actions';

type Menu = {
  name: string;
  value: number;
};

const menus: Menu[] = [
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

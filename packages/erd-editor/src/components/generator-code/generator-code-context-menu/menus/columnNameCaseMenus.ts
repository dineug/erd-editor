import { AppContext } from '@/components/appContext';
import { NameCase } from '@/constants/schema';
import { changeColumnNameCaseAction } from '@/engine/modules/settings/atom.actions';

type Menu = {
  name: string;
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
    value: NameCase.none,
  },
];

export function createColumnNameCaseMenus({ store }: AppContext) {
  const { settings } = store.state;

  return menus.map(menu => {
    const checked = menu.value === settings.columnNameCase;

    return {
      checked,
      name: menu.name,
      onClick: () => {
        store.dispatch(
          changeColumnNameCaseAction({
            value: menu.value,
          })
        );
      },
    };
  });
}

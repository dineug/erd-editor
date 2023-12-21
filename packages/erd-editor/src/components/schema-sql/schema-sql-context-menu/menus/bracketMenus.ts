import { AppContext } from '@/components/appContext';
import { BracketType } from '@/constants/schema';
import { changeBracketTypeAction } from '@/engine/modules/settings/atom.actions';

type Menu = {
  name: string;
  value: number;
};

export const menus: Menu[] = [
  {
    name: 'SingleQuote',
    value: BracketType.singleQuote,
  },
  {
    name: 'DoubleQuote',
    value: BracketType.doubleQuote,
  },
  {
    name: 'Backtick',
    value: BracketType.backtick,
  },
  {
    name: 'None',
    value: BracketType.none,
  },
];

export function createBracketMenus({ store }: AppContext) {
  const { settings } = store.state;

  return menus.map(menu => {
    const checked = menu.value === settings.bracketType;

    return {
      checked,
      name: menu.name,
      onClick: () => {
        store.dispatch(
          changeBracketTypeAction({
            value: menu.value,
          })
        );
      },
    };
  });
}

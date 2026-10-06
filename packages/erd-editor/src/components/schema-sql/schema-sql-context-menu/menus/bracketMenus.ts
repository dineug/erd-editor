import { AppContext } from '@/components/appContext';
import { BracketType } from '@/constants/schema';
import { changeBracketTypeAction } from '@/engine/modules/settings/atom.actions';
import type { PlainMessageKey } from '@/i18n/translate';

type Menu = {
  name: string;
  labelKey?: PlainMessageKey;
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
    labelKey: 'common.none',
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
      labelKey: menu.labelKey,
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

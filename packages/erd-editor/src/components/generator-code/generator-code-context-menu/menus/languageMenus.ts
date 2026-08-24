import { AppContext } from '@/components/appContext';
import { Language } from '@/constants/schema';
import { changeLanguageAction } from '@/engine/modules/settings/atom.actions';

type Menu = {
  name: string;
  value: number;
};

export const menus: Menu[] = [
  {
    name: 'GraphQL',
    value: Language.GraphQL,
  },
  {
    name: 'C#',
    value: Language.csharp,
  },
  {
    name: 'Java',
    value: Language.Java,
  },
  {
    name: 'Kotlin',
    value: Language.Kotlin,
  },
  {
    name: 'TypeScript',
    value: Language.TypeScript,
  },
  {
    name: 'JPA',
    value: Language.JPA,
  },
  {
    name: 'Scala',
    value: Language.Scala,
  },
  {
    name: 'Go',
    value: Language.Go,
  },
  {
    name: 'SQLAlchemy',
    value: Language.SQLAlchemy,
  },
  {
    name: 'TypeORM',
    value: Language.TypeORM,
  },
  {
    name: 'Sequelize',
    value: Language.Sequelize,
  },
];

export function createLanguageMenus({ store }: AppContext) {
  const { settings } = store.state;

  return menus.map(menu => {
    const checked = menu.value === settings.language;

    return {
      checked,
      name: menu.name,
      onClick: () => {
        store.dispatch(
          changeLanguageAction({
            value: menu.value,
          })
        );
      },
    };
  });
}

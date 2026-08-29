import { AppContext } from '@/components/appContext';
import { Language } from '@/constants/schema';
import { changeLanguageAction } from '@/engine/modules/settings/atom.actions';

type Menu = {
  name: string;
  value: number;
};

// Three groups, each ascending by name: languages, ORMs, schema DSLs.
export const menus: Menu[] = [
  {
    name: 'C#',
    value: Language.csharp,
  },
  {
    name: 'Go',
    value: Language.Go,
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
    name: 'Scala',
    value: Language.Scala,
  },
  {
    name: 'TypeScript',
    value: Language.TypeScript,
  },
  {
    name: 'Drizzle',
    value: Language.Drizzle,
  },
  {
    name: 'JPA',
    value: Language.JPA,
  },
  {
    name: 'Sequelize',
    value: Language.Sequelize,
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
    name: 'AML',
    value: Language.AML,
  },
  {
    name: 'DBML',
    value: Language.DBML,
  },
  {
    name: 'GraphQL',
    value: Language.GraphQL,
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

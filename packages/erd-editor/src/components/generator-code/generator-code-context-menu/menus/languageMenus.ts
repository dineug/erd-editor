import { AppContext } from '@/components/appContext';
import { Language } from '@/constants/schema';
import { changeLanguageAction } from '@/engine/modules/settings/atom.actions';

type Menu = {
  name: string;
  value: number;
};

/**
 * The menu's three groups, a rule between each two, every group ascending by
 * name ignoring case: the languages, the ORMs, and the schemas, which hold the
 * tables written in another schema language or library.
 */
export const menuGroups: ReadonlyArray<ReadonlyArray<Menu>> = [
  [
    { name: 'C#', value: Language.csharp },
    { name: 'Go', value: Language.Go },
    { name: 'Java', value: Language.Java },
    { name: 'Kotlin', value: Language.Kotlin },
    { name: 'PHP', value: Language.PHP },
    { name: 'Rust', value: Language.Rust },
    { name: 'Scala', value: Language.Scala },
    { name: 'Swift', value: Language.Swift },
    { name: 'TypeScript', value: Language.TypeScript },
  ],
  [
    { name: 'Doctrine', value: Language.Doctrine },
    { name: 'Drizzle', value: Language.Drizzle },
    { name: 'JPA', value: Language.JPA },
    { name: 'SeaORM', value: Language.SeaORM },
    { name: 'Sequelize', value: Language.Sequelize },
    { name: 'SQLAlchemy', value: Language.SQLAlchemy },
    { name: 'TypeORM', value: Language.TypeORM },
  ],
  [
    { name: 'AML', value: Language.AML },
    { name: 'DBML', value: Language.DBML },
    { name: 'GraphQL', value: Language.GraphQL },
    { name: 'JSON Schema', value: Language.JSONSchema },
    { name: 'Mermaid', value: Language.Mermaid },
    { name: 'Zod', value: Language.Zod },
  ],
];

/** Every language in menu order, with no rule, which the palette and the Settings lock row read. */
export const menus: Menu[] = menuGroups.flat();

export function createLanguageMenus({ store }: AppContext) {
  const { settings } = store.state;

  return menuGroups.flatMap((group, groupIndex) =>
    group.map((menu, index) => {
      const checked = menu.value === settings.language;

      return {
        checked,
        name: menu.name,
        // The first row of every group past the first, which a rule sets apart.
        separated: groupIndex > 0 && index === 0,
        onClick: () => {
          store.dispatch(
            changeLanguageAction({
              value: menu.value,
            })
          );
        },
      };
    })
  );
}

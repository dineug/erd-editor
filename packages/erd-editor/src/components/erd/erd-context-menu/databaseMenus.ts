import { SchemaV3Constants } from '@dineug/erd-editor-schema';

import { AppContext } from '@/components/context';
import { changeDatabaseAction } from '@/engine/modules/settings/atom.actions';

type Menu = {
  name: string;
  value: number;
};

const menus: Menu[] = [
  {
    name: 'MSSQL',
    value: SchemaV3Constants.Database.MSSQL,
  },
  {
    name: 'MariaDB',
    value: SchemaV3Constants.Database.MariaDB,
  },
  {
    name: 'MySQL',
    value: SchemaV3Constants.Database.MySQL,
  },
  {
    name: 'Oracle',
    value: SchemaV3Constants.Database.Oracle,
  },
  {
    name: 'PostgreSQL',
    value: SchemaV3Constants.Database.PostgreSQL,
  },
  {
    name: 'SQLite',
    value: SchemaV3Constants.Database.SQLite,
  },
];

export function createDatabaseMenus({ store }: AppContext) {
  const { settings } = store.state;

  return menus.map(menu => {
    const checked = menu.value === settings.database;

    return {
      checked,
      name: menu.name,
      onClick: () => {
        store.dispatch(
          changeDatabaseAction({
            value: menu.value,
          })
        );
      },
    };
  });
}

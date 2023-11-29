import { AppContext } from '@/components/appContext';
import { Database } from '@/constants/schema';
import { changeDatabaseAction } from '@/engine/modules/settings/atom.actions';

type Menu = {
  name: string;
  value: number;
};

const menus: Menu[] = [
  {
    name: 'MSSQL',
    value: Database.MSSQL,
  },
  {
    name: 'MariaDB',
    value: Database.MariaDB,
  },
  {
    name: 'MySQL',
    value: Database.MySQL,
  },
  {
    name: 'Oracle',
    value: Database.Oracle,
  },
  {
    name: 'PostgreSQL',
    value: Database.PostgreSQL,
  },
  {
    name: 'SQLite',
    value: Database.SQLite,
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

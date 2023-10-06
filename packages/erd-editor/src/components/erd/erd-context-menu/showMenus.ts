import { SchemaV3Constants } from '@dineug/erd-editor-schema';

import { AppContext } from '@/components/context';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';

type Menu = {
  name: string;
  show: number;
};

const menus: Menu[] = [
  {
    name: 'Table Comment',
    show: SchemaV3Constants.Show.tableComment,
  },
  {
    name: 'Column Comment',
    show: SchemaV3Constants.Show.columnComment,
  },
  {
    name: 'DataType',
    show: SchemaV3Constants.Show.columnDataType,
  },
  {
    name: 'Default',
    show: SchemaV3Constants.Show.columnDefault,
  },
  {
    name: 'Not Null',
    show: SchemaV3Constants.Show.columnNotNull,
  },
  {
    name: 'Unique',
    show: SchemaV3Constants.Show.columnUnique,
  },
  {
    name: 'Auto Increment',
    show: SchemaV3Constants.Show.columnAutoIncrement,
  },
  {
    name: 'Relationship',
    show: SchemaV3Constants.Show.relationship,
  },
];

export function createShowMenus({ store }: AppContext) {
  const { settings } = store.state;

  return menus.map(menu => {
    const checked = menu.show & settings.show;

    return {
      checked,
      name: menu.name,
      onClick: () => {
        store.dispatch(
          changeShowAction({
            show: menu.show,
            value: !checked,
          })
        );
      },
    };
  });
}

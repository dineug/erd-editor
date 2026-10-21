import { FC } from '@dineug/r-html';

import { DICTIONARY_FILE_FORMAT } from '@/components/dictionary/dictionaryFile';
import { useI18n } from '@/components/localeContext';
import ContextMenu from '@/components/primitives/context-menu/ContextMenu';
import Icon from '@/components/primitives/icon/Icon';
import Kbd from '@/components/primitives/kbd/Kbd';

export type DictionaryContextMenuProps = {
  /** The rows the selection covers, which Insert adds beside it and Delete removes. */
  count: number;
  /** The header of the column right clicked, which the sorts order the sheet by. */
  column: string;
  /** The chord that inserts below in the grid, shown beside its row. */
  insertShortcut?: string;
  /** The chord that deletes in the grid, shown beside its row. */
  deleteShortcut?: string;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDeleteRows: () => void;
  onSortAscending: () => void;
  onSortDescending: () => void;
  onImport: () => void;
  onExport: () => void;
};

/**
 * The menu a right click on an entry sheet's cell opens: as many rows as the
 * selection covers inserted above or below it or removed, the sheet sorted by
 * the column, and a CSV file in and out, as the bar's buttons do.
 */
const DictionaryContextMenu: FC<DictionaryContextMenuProps> = (props, ctx) => {
  const i18n = useI18n(ctx);

  return () => {
    const { t } = i18n.value;
    const { count, column } = props;
    const format = DICTIONARY_FILE_FORMAT;

    return (
      <ContextMenu.Root
        children={
          <>
            <ContextMenu.Item
              onClick={props.onInsertAbove}
              children={
                <ContextMenu.Menu
                  icon={<Icon name="arrow-up" size={14} />}
                  name={t('dictionary.menu.insertAbove', { count })}
                />
              }
            />
            <ContextMenu.Item
              onClick={props.onInsertBelow}
              children={
                <ContextMenu.Menu
                  icon={<Icon name="arrow-down" size={14} />}
                  name={t('dictionary.menu.insertBelow', { count })}
                  right={<Kbd shortcut={props.insertShortcut} />}
                />
              }
            />
            <ContextMenu.Item
              onClick={props.onDeleteRows}
              children={
                <ContextMenu.Menu
                  name={t('dictionary.menu.deleteRows', { count })}
                  right={<Kbd shortcut={props.deleteShortcut} />}
                />
              }
            />
            <ContextMenu.Separator />
            <ContextMenu.Item
              onClick={props.onSortAscending}
              children={
                <ContextMenu.Menu
                  name={t('dictionary.menu.sortAscending', { column })}
                />
              }
            />
            <ContextMenu.Item
              onClick={props.onSortDescending}
              children={
                <ContextMenu.Menu
                  name={t('dictionary.menu.sortDescending', { column })}
                />
              }
            />
            <ContextMenu.Separator />
            <ContextMenu.Item
              onClick={props.onImport}
              children={
                <ContextMenu.Menu
                  icon={<Icon name="upload" size={14} />}
                  name={t('dictionary.import', { format })}
                />
              }
            />
            <ContextMenu.Item
              onClick={props.onExport}
              children={
                <ContextMenu.Menu
                  icon={<Icon name="download" size={14} />}
                  name={t('dictionary.export', { format })}
                />
              }
            />
          </>
        }
      />
    );
  };
};

export default DictionaryContextMenu;

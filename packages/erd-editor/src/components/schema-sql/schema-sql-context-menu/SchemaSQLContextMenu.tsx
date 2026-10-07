import { FC, onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { createDatabaseMenus } from '@/components/erd/erd-context-menu/menus/databaseMenus';
import { useI18n } from '@/components/localeContext';
import ContextMenu from '@/components/primitives/context-menu/ContextMenu';
import SubmenuChevron from '@/components/primitives/context-menu/submenu-chevron/SubmenuChevron';
import Icon from '@/components/primitives/icon/Icon';
import {
  resolvePanel,
  schemaSQLViewOf,
  toggleSchemaSQLPanel,
} from '@/components/schema-sql/schemaSQLView';
import { useUnmounted } from '@/hooks/useUnmounted';
import { menuLabel } from '@/i18n/menuLabel';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import { createBracketMenus } from './menus/bracketMenus';
import { createHeaderMenus } from './menus/headerMenus';
import { createStatementsMenus } from './menus/statementsMenus';

export type SchemaSQLContextMenuProps = {
  /** The whole document's tab, which adds the statements, the header, the panel and Save file to the menu. */
  full?: boolean;
  onSave?: () => void;
  onClose: () => void;
};

type ChoiceMenu = {
  name: string;
  literal?: boolean;
  checked: boolean;
  note: string | null;
  onClick?: () => void;
};

const SchemaSQLContextMenu: FC<SchemaSQLContextMenuProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const chevronRightIcon = <SubmenuChevron />;
  const { addUnsubscribe } = useUnmounted();

  onMounted(() => {
    const { shortcut$ } = app.value;

    addUnsubscribe(
      shortcut$.subscribe(({ type }) => {
        type === KeyBindingName.stop && props.onClose();
      })
    );
  });

  const handleTogglePanel = () => {
    toggleSchemaSQLPanel(app.value);
    props.onClose();
  };

  const handleSave = () => {
    props.onSave?.();
    props.onClose();
  };

  const renderChoices = (menus: ChoiceMenu[]) => (
    <>
      {menus.map(menu => (
        <ContextMenu.Item
          onClick={menu.onClick}
          children={
            <ContextMenu.Menu
              icon={menu.checked ? <Icon name="check" size={14} /> : null}
              name={menu.name}
              literal={menu.literal ?? true}
              right={
                menu.note ? (
                  <span style={{ color: 'var(--placeholder)' }}>
                    {menu.note}
                  </span>
                ) : null
              }
            />
          }
        />
      ))}
    </>
  );

  return () => {
    const { t } = i18n.value;
    const { store } = app.value;
    // Only the whole document's tab settles the panel, at the width it opens at.
    const panelOpen =
      props.full &&
      resolvePanel(
        schemaSQLViewOf(app.value),
        store.state.editor.viewport.width
      ) === 'open';

    return (
      <ContextMenu.Root
        children={
          <>
            <ContextMenu.Item
              children={
                <ContextMenu.Menu
                  icon={<Icon name="database" size={14} />}
                  name={t('common.database')}
                  right={chevronRightIcon}
                />
              }
              subChildren={
                <>
                  {createDatabaseMenus(app.value).map(menu => (
                    <ContextMenu.Item
                      onClick={menu.onClick}
                      children={
                        <ContextMenu.Menu
                          icon={
                            menu.checked ? (
                              <Icon name="check" size={14} />
                            ) : null
                          }
                          name={menu.name}
                          literal={true}
                        />
                      }
                    />
                  ))}
                </>
              }
            />
            <ContextMenu.Item
              children={
                <ContextMenu.Menu
                  icon={<Icon name="brackets" size={14} />}
                  name={t('common.bracket')}
                  right={chevronRightIcon}
                />
              }
              subChildren={
                <>
                  {createBracketMenus(app.value).map(menu => (
                    <ContextMenu.Item
                      onClick={menu.onClick}
                      children={
                        <ContextMenu.Menu
                          icon={
                            menu.checked ? (
                              <Icon name="check" size={14} />
                            ) : null
                          }
                          name={menuLabel(i18n.value, menu)}
                        />
                      }
                    />
                  ))}
                </>
              }
            />
            {props.full ? (
              <>
                <ContextMenu.Item
                  children={
                    <ContextMenu.Menu
                      icon={<Icon name="settings-2" size={14} />}
                      name={t('schemaSql.statements')}
                      right={chevronRightIcon}
                    />
                  }
                  subChildren={renderChoices(
                    createStatementsMenus(app.value, i18n.value)
                  )}
                />
                <ContextMenu.Item
                  children={
                    <ContextMenu.Menu
                      name={t('schemaSql.header')}
                      right={chevronRightIcon}
                    />
                  }
                  subChildren={renderChoices(
                    createHeaderMenus(app.value, i18n.value)
                  )}
                />
                <ContextMenu.Item
                  onClick={handleTogglePanel}
                  children={
                    <ContextMenu.Menu
                      icon={panelOpen ? <Icon name="check" size={14} /> : null}
                      name={t('schemaSql.optionsPanel')}
                    />
                  }
                />
                <ContextMenu.Item
                  onClick={handleSave}
                  children={
                    <ContextMenu.Menu
                      icon={<Icon name="download" size={14} />}
                      name={t('schemaSql.saveFileMenu')}
                    />
                  }
                />
              </>
            ) : null}
          </>
        }
      />
    );
  };
};

export default SchemaSQLContextMenu;

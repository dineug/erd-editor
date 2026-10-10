import { FC, onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { createDatabaseMenus } from '@/components/erd/erd-context-menu/menus/databaseMenus';
import {
  generatorCodeViewOf,
  toggleGeneratorCodePanel,
} from '@/components/generator-code/generatorCodeView';
import { readsBracket } from '@/components/generator-code/languageSettings';
import { useI18n } from '@/components/localeContext';
import ContextMenu from '@/components/primitives/context-menu/ContextMenu';
import SubmenuChevron from '@/components/primitives/context-menu/submenu-chevron/SubmenuChevron';
import Icon from '@/components/primitives/icon/Icon';
import { createBracketMenus } from '@/components/schema-sql/schema-sql-context-menu/menus/bracketMenus';
import { resolvePanel } from '@/components/schema-sql/schemaSQLView';
import { useUnmounted } from '@/hooks/useUnmounted';
import { menuLabel } from '@/i18n/menuLabel';
import type { PlainMessageKey } from '@/i18n/translate';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import { createColumnNameCaseMenus } from './menus/columnNameCaseMenus';
import { createLanguageMenus } from './menus/languageMenus';
import { createTableNameCaseMenus } from './menus/tableNameCaseMenus';

export type GeneratorCodeContextMenuProps = {
  /** The whole document's tab, which adds the panel and Save file to the menu. */
  full?: boolean;
  onSave?: () => void;
  onClose: () => void;
};

type CheckMenu = {
  checked: boolean;
  name: string;
  labelKey?: PlainMessageKey;
  onClick: () => void;
};

const GeneratorCodeContextMenu: FC<GeneratorCodeContextMenuProps> = (
  props,
  ctx
) => {
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
    toggleGeneratorCodePanel(app.value);
    props.onClose();
  };

  const handleSave = () => {
    props.onSave?.();
    props.onClose();
  };

  /** A submenu's rows, the one in force checked, named as written or by its key. */
  const renderChoices = (menus: CheckMenu[], literal: boolean) => (
    <>
      {menus.map(menu => (
        <ContextMenu.Item
          onClick={menu.onClick}
          children={
            <ContextMenu.Menu
              icon={menu.checked ? <Icon name="check" size={14} /> : null}
              name={menuLabel(i18n.value, menu)}
              literal={literal}
            />
          }
        />
      ))}
    </>
  );

  return () => {
    const { t } = i18n.value;
    const { store } = app.value;
    const { language } = store.state.settings;
    // Only the whole document's tab settles the panel, at the width it opens at.
    const panelOpen =
      props.full &&
      resolvePanel(
        generatorCodeViewOf(app.value),
        store.state.editor.viewport.width
      ) === 'open';

    return (
      <ContextMenu.Root
        children={
          <>
            <ContextMenu.Item
              children={
                <ContextMenu.Menu
                  icon={<Icon name="code" size={14} />}
                  name={t('common.codeLanguage')}
                  right={chevronRightIcon}
                />
              }
              subChildren={
                <>
                  {createLanguageMenus(app.value).map(menu => (
                    <>
                      {menu.separated ? <ContextMenu.Separator /> : null}
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
                    </>
                  ))}
                </>
              }
            />
            <ContextMenu.Item
              children={
                <ContextMenu.Menu
                  icon={<Icon name="database" size={14} />}
                  name={t('common.database')}
                  right={chevronRightIcon}
                />
              }
              subChildren={renderChoices(createDatabaseMenus(app.value), true)}
            />
            <ContextMenu.Item
              children={
                <ContextMenu.Menu
                  icon={<Icon name="case-sensitive" size={14} />}
                  name={t('common.tableNameCase')}
                  right={chevronRightIcon}
                />
              }
              subChildren={
                <>
                  {createTableNameCaseMenus(app.value).map(menu => (
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
            <ContextMenu.Item
              children={
                <ContextMenu.Menu
                  icon={<Icon name="case-sensitive" size={14} />}
                  name={t('common.columnNameCase')}
                  right={chevronRightIcon}
                />
              }
              subChildren={
                <>
                  {createColumnNameCaseMenus(app.value).map(menu => (
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
            {readsBracket(language) ? (
              <ContextMenu.Item
                children={
                  <ContextMenu.Menu
                    icon={<Icon name="brackets" size={14} />}
                    name={t('common.bracket')}
                    right={chevronRightIcon}
                  />
                }
                subChildren={renderChoices(
                  createBracketMenus(app.value),
                  false
                )}
              />
            ) : null}
            {props.full ? (
              <>
                <ContextMenu.Item
                  onClick={handleTogglePanel}
                  children={
                    <ContextMenu.Menu
                      icon={panelOpen ? <Icon name="check" size={14} /> : null}
                      name={t('code.optionsPanel')}
                    />
                  }
                />
                <ContextMenu.Item
                  onClick={handleSave}
                  children={
                    <ContextMenu.Menu
                      icon={<Icon name="download" size={14} />}
                      name={t('code.saveFileMenu')}
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

export default GeneratorCodeContextMenu;

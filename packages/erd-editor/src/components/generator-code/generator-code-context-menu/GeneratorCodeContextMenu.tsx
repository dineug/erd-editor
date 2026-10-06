import { FC, onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useI18n } from '@/components/localeContext';
import ContextMenu from '@/components/primitives/context-menu/ContextMenu';
import SubmenuChevron from '@/components/primitives/context-menu/submenu-chevron/SubmenuChevron';
import Icon from '@/components/primitives/icon/Icon';
import { useUnmounted } from '@/hooks/useUnmounted';
import { menuLabel } from '@/i18n/menuLabel';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import { createColumnNameCaseMenus } from './menus/columnNameCaseMenus';
import { createLanguageMenus } from './menus/languageMenus';
import { createTableNameCaseMenus } from './menus/tableNameCaseMenus';

export type GeneratorCodeContextMenuProps = {
  onClose: () => void;
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

  return () => {
    const { t } = i18n.value;

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
          </>
        }
      />
    );
  };
};

export default GeneratorCodeContextMenu;

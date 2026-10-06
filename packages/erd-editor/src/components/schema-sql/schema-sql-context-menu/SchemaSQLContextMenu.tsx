import { FC, onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { createDatabaseMenus } from '@/components/erd/erd-context-menu/menus/databaseMenus';
import { useI18n } from '@/components/localeContext';
import ContextMenu from '@/components/primitives/context-menu/ContextMenu';
import Icon from '@/components/primitives/icon/Icon';
import { useUnmounted } from '@/hooks/useUnmounted';
import { menuLabel } from '@/i18n/menuLabel';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import { createBracketMenus } from './menus/bracketMenus';

export type SchemaSQLContextMenuProps = {
  onClose: () => void;
};

const SchemaSQLContextMenu: FC<SchemaSQLContextMenuProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const chevronRightIcon = <Icon name="chevron-right" size={14} />;
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
          </>
        }
      />
    );
  };
};

export default SchemaSQLContextMenu;

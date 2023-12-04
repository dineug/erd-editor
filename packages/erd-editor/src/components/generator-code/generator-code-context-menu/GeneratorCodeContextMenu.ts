import { FC, html, onMounted } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import ContextMenu from '@/components/primitives/context-menu/ContextMenu';
import Icon from '@/components/primitives/icon/Icon';
import { useUnmounted } from '@/hooks/useUnmounted';
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
  const chevronRightIcon = html`<${Icon} name="chevron-right" size=${14} />`;
  const { addUnsubscribe } = useUnmounted();

  onMounted(() => {
    const { shortcut$ } = app.value;

    addUnsubscribe(
      shortcut$.subscribe(({ type }) => {
        type === KeyBindingName.stop && props.onClose();
      })
    );
  });

  return () => html`
    <${ContextMenu.Root}
      children=${html`
        <${ContextMenu.Item}
          children=${html`
            <${ContextMenu.Menu}
              icon=${html`<${Icon} name="code" size=${14} />`}
              name="Language"
              right=${chevronRightIcon}
            />
          `}
          subChildren=${html`${createLanguageMenus(app.value).map(
            menu => html`
              <${ContextMenu.Item}
                .onClick=${menu.onClick}
                children=${html`
                  <${ContextMenu.Menu}
                    icon=${menu.checked
                      ? html`<${Icon} name="check" size=${14} />`
                      : null}
                    name=${menu.name}
                  />
                `}
              />
            `
          )}`}
        />
        <${ContextMenu.Item}
          children=${html`
            <${ContextMenu.Menu}
              icon=${html`
                <${Icon} prefix="mdi" name="format-letter-case" size=${14} />
              `}
              name="Table Name Case"
              right=${chevronRightIcon}
            />
          `}
          subChildren=${html`${createTableNameCaseMenus(app.value).map(
            menu => html`
              <${ContextMenu.Item}
                .onClick=${menu.onClick}
                children=${html`
                  <${ContextMenu.Menu}
                    icon=${menu.checked
                      ? html`<${Icon} name="check" size=${14} />`
                      : null}
                    name=${menu.name}
                  />
                `}
              />
            `
          )}`}
        />
        <${ContextMenu.Item}
          children=${html`
            <${ContextMenu.Menu}
              icon=${html`<${Icon}
                prefix="mdi"
                name="format-letter-case"
                size=${14}
              />`}
              name="Column Name Case"
              right=${chevronRightIcon}
            />
          `}
          subChildren=${html`${createColumnNameCaseMenus(app.value).map(
            menu => html`
              <${ContextMenu.Item}
                .onClick=${menu.onClick}
                children=${html`
                  <${ContextMenu.Menu}
                    icon=${menu.checked
                      ? html`<${Icon} name="check" size=${14} />`
                      : null}
                    name=${menu.name}
                  />
                `}
              />
            `
          )}`}
        />
      `}
    />
  `;
};

export default GeneratorCodeContextMenu;

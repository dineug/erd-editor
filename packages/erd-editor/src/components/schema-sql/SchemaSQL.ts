import { delay } from '@dineug/go';
import { FC, html, observable, onBeforeMount, watch } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import CodeBlock from '@/components/primitives/code-block/CodeBlock';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import Toast from '@/components/primitives/toast/Toast';
import SchemaSQLContextMenu from '@/components/schema-sql/schema-sql-context-menu/SchemaSQLContextMenu';
import { useUnmounted } from '@/hooks/useUnmounted';
import { copyToClipboard } from '@/utils/clipboard';
import { openToastAction } from '@/utils/emitter';
import { createSchemaSQL } from '@/utils/schemaSQL';

import * as styles from './SchemaSQL.styles';

export type SchemaSQLProps = {};

const SchemaSQL: FC<SchemaSQLProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const contextMenu = useContextMenuRootProvider(ctx);

  const state = observable({
    sql: '',
  });

  const setSQL = () => {
    const { store } = app.value;
    state.sql = createSchemaSQL(store.state);
  };

  const handleCopy = () => {
    const { emitter } = app.value;

    copyToClipboard(state.sql).then(() => {
      emitter.emit(
        openToastAction({
          close: delay(2000),
          message: html`<${Toast} description="Copied!" />`,
        })
      );
    });
  };

  const handleContextmenuClose = () => {
    contextMenu.state.show = false;
  };

  onBeforeMount(() => {
    const { store } = app.value;
    const { settings } = store.state;

    setSQL();

    addUnsubscribe(
      watch(settings).subscribe(propName => {
        if (propName !== 'database' && propName !== 'bracketType') {
          return;
        }

        setSQL();
      })
    );
  });

  return () => html`
    <div
      class=${styles.root}
      @contextmenu=${contextMenu.onContextmenu}
      @mousedown=${contextMenu.onMousedown}
    >
      <${CodeBlock} value=${state.sql} .onCopy=${handleCopy} />
      <${SchemaSQLContextMenu} .onClose=${handleContextmenuClose} />
    </div>
  `;
};

export default SchemaSQL;

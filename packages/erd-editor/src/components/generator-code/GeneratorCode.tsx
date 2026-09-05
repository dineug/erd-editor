import { query } from '@dineug/erd-editor-schema';
import { FC, observable, onBeforeMount, watch } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import GeneratorCodeContextMenu from '@/components/generator-code/generator-code-context-menu/GeneratorCodeContextMenu';
import CodeBlock from '@/components/primitives/code-block/CodeBlock';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import Toast from '@/components/primitives/toast/Toast';
import { LanguageToLangMap } from '@/constants/language';
import { useUnmounted } from '@/hooks/useUnmounted';
import { arrayHas } from '@/utils/arrayHas';
import { copyToClipboard } from '@/utils/clipboard';
import { openToastAction } from '@/utils/emitter';
import {
  createGeneratorCode,
  createGeneratorCodeTable,
} from '@/utils/generator-code';
import { delay } from '@/utils/promise';

import * as styles from './GeneratorCode.styles';

const hasPropName = arrayHas<string | number | symbol>([
  'language',
  'tableNameCase',
  'columnNameCase',
]);

export type GeneratorCodeProps = {
  isDarkMode: boolean;
  tableId?: string;
};

const GeneratorCode: FC<GeneratorCodeProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const contextMenu = useContextMenuRootProvider(ctx);

  const state = observable({
    code: '',
  });

  const setCode = () => {
    const { store } = app.value;

    if (props.tableId) {
      const { collections } = store.state;
      const table = query(collections)
        .collection('tableEntities')
        .selectById(props.tableId);

      if (table) {
        state.code = createGeneratorCodeTable(store.state, table);
      }
    } else {
      state.code = createGeneratorCode(store.state);
    }
  };

  const handleCopy = () => {
    const { emitter } = app.value;

    copyToClipboard(state.code).then(() => {
      emitter.emit(
        openToastAction({
          close: delay(2000),
          message: <Toast title="Copied!" />,
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

    setCode();

    addUnsubscribe(
      watch(settings).subscribe(propName => {
        hasPropName(propName) && setCode();
      }),
      watch(props).subscribe(propName => {
        propName === 'tableId' && setCode();
      })
    );
  });

  return () => {
    const { store } = app.value;
    const {
      settings: { language },
    } = store.state;
    const lang = LanguageToLangMap[language];

    return (
      <div
        class={styles.root}
        on:contextmenu={contextMenu.onContextmenu}
        on:mousedown={contextMenu.onMousedown}
      >
        <CodeBlock
          lang={lang}
          theme={props.isDarkMode ? 'dark' : 'light'}
          value={state.code}
          onCopy={handleCopy}
        />
        {contextMenu.state.show ? (
          <GeneratorCodeContextMenu onClose={handleContextmenuClose} />
        ) : null}
      </div>
    );
  };
};

export default GeneratorCode;

import { delay } from '@dineug/go';
import { FC, html, observable, onBeforeMount, watch } from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';

import { useAppContext } from '@/components/appContext';
import GeneratorCodeContextMenu from '@/components/generator-code/generator-code-context-menu/GeneratorCodeContextMenu';
import CodeBlock from '@/components/primitives/code-block/CodeBlock';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import Toast from '@/components/primitives/toast/Toast';
import { LanguageToLangMap } from '@/constants/language';
import { useUnmounted } from '@/hooks/useUnmounted';
import { copyToClipboard } from '@/utils/clipboard';
import { openToastAction } from '@/utils/emitter';
import { createGeneratorCode } from '@/utils/generator-code';

import * as styles from './GeneratorCode.styles';

const hasPropName = arrayHas<string | number | symbol>([
  'language',
  'tableNameCase',
  'columnNameCase',
]);

export type GeneratorCodeProps = {
  isDarkMode: boolean;
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
    state.code = createGeneratorCode(store.state);
  };

  const handleCopy = () => {
    const { emitter } = app.value;

    copyToClipboard(state.code).then(() => {
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

    setCode();

    addUnsubscribe(
      watch(settings).subscribe(propName => {
        hasPropName(propName) && setCode();
      })
    );
  });

  return () => {
    const { store } = app.value;
    const {
      settings: { language },
    } = store.state;
    const lang = LanguageToLangMap[language];

    return html`
      <div
        class=${styles.root}
        @contextmenu=${contextMenu.onContextmenu}
        @mousedown=${contextMenu.onMousedown}
      >
        <${CodeBlock}
          lang=${lang}
          theme=${props.isDarkMode ? 'dark' : 'light'}
          value=${state.code}
          .onCopy=${handleCopy}
        />
        <${GeneratorCodeContextMenu} .onClose=${handleContextmenuClose} />
      </div>
    `;
  };
};

export default GeneratorCode;

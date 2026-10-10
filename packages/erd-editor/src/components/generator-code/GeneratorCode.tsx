import { query } from '@dineug/erd-editor-schema';
import {
  createRef,
  FC,
  nextTick,
  observable,
  onBeforeMount,
  ref,
  watch,
} from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import GeneratorCodeContextMenu from '@/components/generator-code/generator-code-context-menu/GeneratorCodeContextMenu';
import GeneratorCodeOptions from '@/components/generator-code/generator-code-options/GeneratorCodeOptions';
import { generatorCodeViewOf } from '@/components/generator-code/generatorCodeView';
import { codeFileExtension } from '@/components/generator-code/languageSettings';
import { useI18n } from '@/components/localeContext';
import { localized } from '@/components/localized/Localized';
import CodeBlock from '@/components/primitives/code-block/CodeBlock';
import { useContextMenuRootProvider } from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import Icon from '@/components/primitives/icon/Icon';
import Toast from '@/components/primitives/toast/Toast';
import { keepSpace } from '@/components/schema-sql/schema-sql-options/SchemaSQLOptions';
import * as optionsStyles from '@/components/schema-sql/schema-sql-options/SchemaSQLOptions.styles';
import * as styles from '@/components/schema-sql/SchemaSQL.styles';
import { resolvePanel } from '@/components/schema-sql/schemaSQLView';
import { LanguageToLangMap } from '@/constants/language';
import { useUnmounted } from '@/hooks/useUnmounted';
import { arrayHas } from '@/utils/arrayHas';
import { copyToClipboard } from '@/utils/clipboard';
import { openToastAction } from '@/utils/emitter';
import { exportCode } from '@/utils/file/exportFile';
import {
  createGeneratorCode,
  createGeneratorCodeTable,
} from '@/utils/generator-code';
import { delay } from '@/utils/promise';

/**
 * The settings the code is written from. A document edit writes it again only
 * as the tab mounts, so the text stays the snapshot the reader is looking at.
 */
const hasPropName = arrayHas<string | number | symbol>([
  'language',
  'database',
  'tableNameCase',
  'columnNameCase',
  'bracketType',
]);

export type GeneratorCodeProps = {
  isDarkMode: boolean;
  /** One table's code, as Table Properties shows it, with no panel. */
  tableId?: string;
};

const GeneratorCode: FC<GeneratorCodeProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const { addUnsubscribe } = useUnmounted();
  const contextMenu = useContextMenuRootProvider(ctx);
  const root = createRef<HTMLDivElement>();
  const showButton = createRef<HTMLButtonElement>();

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
          message: <Toast title={localized('common.toast.copied')} />,
        })
      );
    });
  };

  const handleSave = () => {
    const { settings } = app.value.store.state;
    exportCode(
      state.code,
      codeFileExtension(settings.language),
      settings.databaseName
    );
  };

  const handleHide = () => {
    generatorCodeViewOf(app.value).panel = 'closed';
    // The button is the code block's tools, which it renders a tick after this
    // component hands them over.
    nextTick(() => nextTick(() => showButton.value?.focus()));
  };

  const handleShow = () => {
    generatorCodeViewOf(app.value).panel = 'open';
    nextTick(() => {
      root.value
        ?.querySelector<HTMLButtonElement>('.generator-code-options-hide')
        ?.focus();
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
    const { t, dir } = i18n.value;
    const lang = LanguageToLangMap[store.state.settings.language];
    const full = !props.tableId;
    const view = generatorCodeViewOf(app.value);
    // The width is read only while the panel is unset, so a decided panel
    // never renders again for a resize.
    const panel = !full
      ? 'unknown'
      : view.panel === 'unset'
        ? resolvePanel(view, store.state.editor.viewport.width)
        : view.panel;

    // The code stays left of the panel in every language; the panel and the
    // menu read in the reader's direction.
    return (
      <>
        <div
          use:ref={ref(root)}
          class={styles.root}
          prop:dir="ltr"
          on:mousedown={contextMenu.onMousedown}
        >
          <div class={styles.code} on:contextmenu={contextMenu.onContextmenu}>
            <CodeBlock
              lang={lang}
              theme={props.isDarkMode ? 'dark' : 'light'}
              value={state.code}
              onCopy={handleCopy}
              tools={
                panel === 'closed' ? (
                  <button
                    use:ref={ref(showButton)}
                    type="button"
                    class={[
                      'generator-code-options-show',
                      optionsStyles.icon,
                      styles.show,
                    ]}
                    aria-label={t('code.showOptions')}
                    title={t('code.showOptions')}
                    aria-expanded="false"
                    on:click={handleShow}
                    on:keydown={keepSpace}
                  >
                    <Icon name="panel-right-open" size={16} />
                  </button>
                ) : null
              }
            />
          </div>
          {panel === 'open' ? (
            <GeneratorCodeOptions
              isDarkMode={props.isDarkMode}
              onHide={handleHide}
              onSave={handleSave}
              onCopy={handleCopy}
            />
          ) : null}
        </div>
        {contextMenu.state.show ? (
          <div prop:dir={dir}>
            <GeneratorCodeContextMenu
              full={full}
              onSave={handleSave}
              onClose={handleContextmenuClose}
            />
          </div>
        ) : null}
      </>
    );
  };
};

export default GeneratorCode;

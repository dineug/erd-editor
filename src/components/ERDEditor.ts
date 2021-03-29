import './ERDEditorProvider';
import './Icon';
import './Sash';
import './Contextmenu';
import './PanelView';
import './menubar/Menubar';
import './editor/ERD';
import './drawer/Drawer';
import './drawer/HelpDrawer';
import './drawer/SettingDrawer';
import './drawer/tablePropertiesDrawer/TablePropertiesDrawer';

import {
  ERDEditorProps,
  ERDEditorElement,
} from '@@types/components/ERDEditorElement';
import { PanelConfig } from '@@types/core/panel';
import { Theme } from '@@types/core/theme';
import { Keymap } from '@@types/core/keymap';
import { User } from '@@types/core/share';
import { ExtensionConfig } from '@@types/core/extension';
import {
  defineComponent,
  html,
  FunctionalComponent,
  query,
  mounted,
  unmounted,
  watch,
} from '@dineug/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { cache } from 'lit-html/directives/cache';
import { fromEvent } from 'rxjs';
import { createdERDEditorContext } from '@/core/ERDEditorContext';
import { loadTheme } from '@/core/theme';
import { loadKeymap, keymapMatchAndStop } from '@/core/keymap';
import {
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  SIZE_MENUBAR_HEIGHT,
} from '@/core/layout';
import { isArray, isString } from '@/core/helper';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { useERDEditorGhost } from '@/core/hooks/ERDEditorGhost.hook';
import { useERDEditorDrawer } from '@/core/hooks/ERDEditorDrawer.hook';
import { usePanelView } from '@/core/hooks/panelView.hook';
import {
  editTableEnd,
  changeViewport,
  clear,
  loadJson$,
  initLoadJson$,
} from '@/engine/command/editor.cmd.helper';
import { ignoreEnterProcess } from '@/core/helper/operator.helper';
import { Logger } from '@/core/logger';
import { DDLParser } from '@dineug/sql-ddl-parser';
import { createJson } from '@/core/parser/SQLParserToJson';
import { createJsonStringify } from '@/core/file';
import { sortTable } from '@/engine/command/table.cmd.helper';
import { SettingDrawerStyle } from './drawer/SettingDrawer.style';
import { TablePropertiesDrawerStyle } from './drawer/tablePropertiesDrawer/TablePropertiesDrawer.style';
import { ERDEditorStyle } from './ERDEditor.style';
import { Contextmenu } from '@/core/helper/event.helper';

const ERDEditor: FunctionalComponent<ERDEditorProps, ERDEditorElement> = (
  props,
  ctx
) => {
  const context = createdERDEditorContext();
  const { store, helper, keymap, eventBus } = context;
  const { editorState } = store;
  const editorRef = query<HTMLElement>('.vuerd-editor');
  const { ghostTpl, ghostState, setFocus, onFocus } = useERDEditorGhost(
    context,
    ctx
  );
  const { drawerTpl, closeDrawer, openHelp, openSetting } = useERDEditorDrawer(
    props,
    context
  );
  const { hasPanel, panelTpl } = usePanelView(props, context);
  const { unmountedGroup } = useUnmounted();
  // @ts-ignore
  const resizeObserver = new ResizeObserver(entries => {
    entries.forEach((entry: any) => {
      const { width, height } = entry.contentRect;
      ctx.setAttribute('width', width);
      ctx.setAttribute('height', height);
    });
  });

  const onOutside = (event: MouseEvent | TouchEvent) => {
    const el = event.target as HTMLElement;

    if (el.closest('vuerd-menubar') || el.closest('vuerd-drawer')) {
      store.dispatch(editTableEnd());
    }

    if (!el.closest('vuerd-menubar') && !el.closest('vuerd-drawer')) {
      closeDrawer();
    }
  };

  mounted(() => {
    props.automaticLayout && resizeObserver.observe(editorRef.value);

    unmountedGroup.push(
      watch(props, propName => {
        if (propName !== 'automaticLayout') return;

        if (props.automaticLayout) {
          resizeObserver.observe(editorRef.value);
        } else {
          resizeObserver.disconnect();
        }
      }),
      watch(props, propName => {
        if (propName !== 'width' && propName !== 'height') return;

        store.dispatch(changeViewport(props.width, props.height));
      }),
      fromEvent<KeyboardEvent>(editorRef.value, 'keydown')
        .pipe(ignoreEnterProcess)
        .subscribe(event => {
          Logger.debug(`
metaKey: ${event.metaKey}
ctrlKey: ${event.ctrlKey}
altKey: ${event.altKey}
shiftKey: ${event.shiftKey}
code: ${event.code}
key: ${event.key}
        `);

          helper.keydown$.next(event);
          if (keymapMatchAndStop(event, keymap.stop)) {
            eventBus.emit(Contextmenu.close);
            closeDrawer();
            onFocus();
          }
        })
    );
  });

  unmounted(() => {
    // globalEvent.destroy();
    // store.destroy();
    // helper.destroy();
    resizeObserver.disconnect();
  });

  Object.defineProperty(ctx, 'value', {
    get() {
      const { store } = context;
      return createJsonStringify(store);
    },
    set(json: string) {
      const { store } = context;
      isString(json) && json.trim()
        ? store.dispatch(loadJson$(json))
        : store.dispatch(clear());
    },
  });

  ctx.focus = () => {
    helper.focus();
    setFocus();
  };
  ctx.blur = () => {
    helper.blur();
    setFocus();
  };

  ctx.clear = () => {
    const { store } = context;
    store.dispatch(clear());
  };

  ctx.initLoadJson = (json: string) => {
    if (isString(json) && json.trim()) {
      const { store } = context;
      store.dispatch(initLoadJson$(json));
    }
  };

  ctx.loadSQLDDL = (sql: string) => {
    if (isString(sql) && sql.trim()) {
      const { store, helper } = context;
      const statements = DDLParser(sql);
      const json = createJson(statements, helper, store.canvasState.database);
      store.dispatch(loadJson$(json), sortTable());
    }
  };

  ctx.setTheme = (theme: Partial<Theme>) => loadTheme(context.theme, theme);
  ctx.setKeymap = (keymap: Partial<Keymap>) =>
    loadKeymap(context.keymap, keymap);

  ctx.setUser = (user: User) => {};

  ctx.extension = (config: Partial<ExtensionConfig>) => {
    isArray(config.panels) &&
      editorState.panels.push(...(config.panels as PanelConfig[]));
  };

  return () => {
    const width = props.width;
    const height = props.height - SIZE_MENUBAR_HEIGHT;

    return html`
      <vuerd-provider .value=${context}>
        <div
          class="vuerd-editor"
          style=${styleMap({
            width: props.automaticLayout ? `100%` : `${props.width}px`,
            height: props.automaticLayout ? `100%` : `${props.height}px`,
          })}
          @mousedown=${onOutside}
          @touchstart=${onOutside}
        >
          <vuerd-menubar
            .focusState=${ghostState.focus}
            @open-help=${openHelp}
            @open-setting=${openSetting}
          ></vuerd-menubar>
          ${cache(
            !hasPanel()
              ? html`<vuerd-erd .width=${width} .height=${height}></vuerd-erd>`
              : null
          )}
          ${panelTpl()} ${drawerTpl()} ${ghostTpl}
        </div>
      </vuerd-provider>
    `;
  };
};

const componentOptions = {
  observedProps: [
    {
      name: 'width',
      type: Number,
      default: DEFAULT_WIDTH,
    },
    {
      name: 'height',
      type: Number,
      default: DEFAULT_HEIGHT,
    },
    {
      name: 'automaticLayout',
      type: Boolean,
      default: false,
    },
  ],
  style: [ERDEditorStyle, SettingDrawerStyle, TablePropertiesDrawerStyle].join(
    ''
  ),
  render: ERDEditor,
};

defineComponent('vuerd-editor', componentOptions);
defineComponent('erd-editor', componentOptions);

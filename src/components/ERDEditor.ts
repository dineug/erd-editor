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
import { keymapMatchAndStop } from '@/core/keymap';
import {
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  SIZE_MENUBAR_HEIGHT,
} from '@/core/layout';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { useERDEditorGhost } from '@/core/hooks/ERDEditorGhost.hook';
import { useERDEditorDrawer } from '@/core/hooks/ERDEditorDrawer.hook';
import { useERDEditorElement } from '@/core/hooks/ERDEditorElement.hook';
import { usePanelView } from '@/core/hooks/panelView.hook';
import {
  editTableEnd,
  changeViewport,
  readonlyEditor$,
} from '@/engine/command/editor.cmd.helper';
import { ignoreEnterProcess } from '@/core/operators/ignoreEnterProcess';
import { Bus } from '@/core/helper/eventBus.helper';
import { Logger } from '@/core/logger';
import { IndexStyle } from './index.style';

const ERDEditor: FunctionalComponent<ERDEditorProps, ERDEditorElement> = (
  props,
  ctx
) => {
  const context = createdERDEditorContext();
  const { store, helper, keymap, eventBus } = context;
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
  useERDEditorElement(context, ctx, { setFocus });

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
    store.dispatch(readonlyEditor$(props.readonly));

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
      watch(props, propName => {
        if (propName !== 'readonly') return;

        store.dispatch(readonlyEditor$(props.readonly));
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
            eventBus.emit(Bus.Contextmenu.close);
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
    {
      name: 'readonly',
      type: Boolean,
      default: false,
    },
  ],
  style: IndexStyle,
  render: ERDEditor,
};

defineComponent('vuerd-editor', componentOptions);
defineComponent('erd-editor', componentOptions);

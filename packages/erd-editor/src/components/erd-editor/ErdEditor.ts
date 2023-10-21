import {
  createRef,
  defineCustomElement,
  FC,
  html,
  observable,
  onMounted,
  ref,
  useProvider,
} from '@dineug/r-html';

import { appContext, createAppContext } from '@/components/context';
import Erd from '@/components/erd/Erd';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import Theme from '@/components/theme/Theme';
import Toolbar from '@/components/toolbar/Toolbar';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import { useUnmounted } from '@/hooks/useUnmounted';
import { AccentColor, createTheme, GrayColor } from '@/themes/radix-ui-theme';
import { createText } from '@/utils/text';

import * as styles from './ErdEditor.styles';

declare global {
  interface HTMLElementTagNameMap {
    'erd-editor': ErdEditorElement;
  }
}

export type ErdEditorProps = {};

export interface ErdEditorElement extends ErdEditorProps, HTMLElement {}

const ErdEditor: FC<ErdEditorProps, ErdEditorElement> = (props, ctx) => {
  const text = createText();
  const appContextValue = createAppContext({ toWidth: text.toWidth });
  useProvider(ctx, appContext, appContextValue);

  const root = createRef<HTMLDivElement>();
  useKeyBindingMap(ctx, root);

  const { addUnsubscribe } = useUnmounted();

  const state = observable(
    {
      theme: createTheme({
        grayColor: GrayColor.slate,
        accentColor: AccentColor.indigo,
      })('dark'),
    },
    { shallow: true }
  );

  const handleKeydown = (event: KeyboardEvent) => {
    const { keydown$ } = appContextValue;
    keydown$.next(event);
  };

  onMounted(() => {
    const $root = root.value;
    const { store } = appContextValue;
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        store.dispatch(changeViewportAction({ width, height }));
      }
    });
    resizeObserver.observe($root);
    addUnsubscribe(() => {
      resizeObserver.unobserve($root);
      resizeObserver.disconnect();
    });
  });

  return () => html`
    <${GlobalStyles} />
    <${Theme} .theme=${state.theme} />
    <div
      ${ref(root)}
      class=${styles.root}
      tabindex="-1"
      @keydown=${handleKeydown}
    >
      <${Toolbar} />
      <div class=${styles.main}>
        <${Erd} />
      </div>
      ${text.span}
    </div>
  `;
};

defineCustomElement('erd-editor', {
  render: ErdEditor,
});

import {
  createRef,
  defineCustomElement,
  FC,
  html,
  observable,
  ref,
  useProvider,
} from '@dineug/r-html';

import { appContext, createAppContext } from '@/components/context';
import Erd from '@/components/erd/Erd';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import Theme from '@/components/theme/Theme';
import Toolbar from '@/components/toolbar/Toolbar';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import { createDefaultTheme } from '@/themes/default.theme';
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

  const state = observable(
    {
      theme: createDefaultTheme('dark'),
    },
    { shallow: true }
  );

  return () => html`
    <${GlobalStyles} />
    <${Theme} .theme=${state.theme} />
    <div class=${styles.root} tabindex="-1" ${ref(root)}>
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

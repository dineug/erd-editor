import {
  createRef,
  FC,
  html,
  innerHTML,
  nextTick,
  observable,
  onBeforeMount,
  ref,
  watch,
} from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';

import Icon from '@/components/primitives/icon/Icon';
import { useUnmounted } from '@/hooks/useUnmounted';
import { getShikiService, ShikiService } from '@/services/shikiService';
import { globalEmitter } from '@/utils/globalEmitter';

import * as styles from './CodeBlock.styles';

const hasPropName = arrayHas<string | number | symbol>([
  'value',
  'lang',
  'theme',
]);

export type CodeBlockProps = {
  value: string;
  lang: Parameters<ShikiService['codeToHtml']>[1]['lang'];
  theme?: 'dark' | 'light';
  onCopy?: (value: string) => void;
};

const CodeBlock: FC<CodeBlockProps> = (props, ctx) => {
  const root = createRef<HTMLDivElement>();
  const { addUnsubscribe } = useUnmounted();

  const state = observable({
    highlight: '',
    backgroundColor: '',
  });

  const handleCopy = () => {
    props.onCopy?.(props.value);
  };

  const getBackgroundColor = () => {
    const $root = root.value;
    if (!$root) return null;

    const pre = $root.querySelector('pre.shiki') as HTMLPreElement | null;
    if (!pre) return null;

    const backgroundColor = pre.style.backgroundColor;
    if (!backgroundColor) return null;

    return backgroundColor;
  };

  const setBackgroundColor = () => {
    nextTick(() => {
      state.backgroundColor = getBackgroundColor() || '';
    });
  };

  const setHighlight = () => {
    getShikiService()
      ?.codeToHtml(props.value, {
        lang: props.lang,
        theme: props.theme,
      })
      .then(highlight => {
        state.highlight = highlight;
        setBackgroundColor();
      });
  };

  onBeforeMount(() => {
    setHighlight();

    addUnsubscribe(
      globalEmitter.on({ loadShikiService: setHighlight }),
      watch(props).subscribe(propName => {
        hasPropName(propName) && setHighlight();
      }),
      () => {
        state.highlight = '';
      }
    );
  });

  return () => html`
    <div class=${styles.root} ${ref(root)}>
      <div
        class=${['scrollbar', styles.code]}
        style=${{
          'background-color': state.backgroundColor,
        }}
      >
        ${innerHTML(state.highlight ? state.highlight : props.value)}
      </div>
      <div class=${styles.clipboard} title="Copy" @click=${handleCopy}>
        <${Icon} prefix="far" name="copy" useTransition=${true} />
      </div>
    </div>
  `;
};

export default CodeBlock;

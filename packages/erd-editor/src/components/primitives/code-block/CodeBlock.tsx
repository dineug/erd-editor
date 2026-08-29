import {
  createRef,
  FC,
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
  const preview = createRef<HTMLDivElement>();
  const { addUnsubscribe } = useUnmounted();

  const state = observable({
    highlight: '',
    backgroundColor: '',
  });

  let highlightSource: string | null = null;
  let highlightRequestId = 0;

  // a trailing break is a real last line in a textarea and no line box in the preview
  const getValue = () => props.value.replace(/\n+$/, '');

  const handleCopy = () => {
    props.onCopy?.(getValue());
  };

  /*
   * The overlay refuses edits here rather than through `readonly`, which Chrome paints no caret in.
   * `input` covers the composition paths `beforeinput` cannot cancel.
   */
  const handleBeforeinput = (event: Event) => {
    event.preventDefault();
  };

  const handleInput = (event: Event) => {
    const $textarea = event.target as HTMLTextAreaElement;
    const value = getValue();

    if ($textarea.value !== value) {
      $textarea.value = value;
    }
  };

  // the editor root turns a `paste` that reaches it into a diagram-level action
  const handlePaste = (event: ClipboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const getPre = () => {
    const $preview = preview.value;
    if (!$preview) return null;

    return $preview.querySelector('pre.shiki') as HTMLPreElement | null;
  };

  const getBackgroundColor = () => {
    const pre = getPre();
    if (!pre) return null;

    const backgroundColor = pre.style.backgroundColor;
    if (!backgroundColor) return null;

    return backgroundColor;
  };

  const setBackgroundColor = () => {
    nextTick(() => {
      state.backgroundColor = getBackgroundColor() || '';
      // shiki ships `tabindex="0"`, a tab stop inside the aria-hidden preview
      getPre()?.removeAttribute('tabindex');
    });
  };

  const setHighlight = () => {
    const value = getValue();
    const requestId = ++highlightRequestId;

    // the overlay commits the new value on the next render; stale markup would outlive it
    if (highlightSource !== value) {
      highlightSource = value;
      state.highlight = '';
    }

    getShikiService()
      ?.codeToHtml(value, {
        lang: props.lang,
        theme: props.theme,
      })
      .then(highlight => {
        if (requestId !== highlightRequestId) return;

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

  return () => {
    const value = getValue();

    return (
      <div class={styles.root}>
        <div
          class={['scrollbar', styles.scroller]}
          style={{
            'background-color': state.backgroundColor,
          }}
        >
          <div class={styles.layers}>
            <div
              class={styles.preview}
              aria-hidden="true"
              use:ref={ref(preview)}
            >
              {state.highlight ? innerHTML(state.highlight) : value}
            </div>
            <textarea
              class={styles.textarea}
              aria-label="Code"
              aria-readonly="true"
              inputmode="none"
              tabindex="0"
              spellcheck="false"
              autocorrect="off"
              autocapitalize="off"
              autocomplete="off"
              prop:value={value}
              on:beforeinput={handleBeforeinput}
              on:input={handleInput}
              on:paste={handlePaste}
            ></textarea>
          </div>
        </div>
        <div class={styles.clipboard} title="Copy" on:click={handleCopy}>
          <Icon name="copy" useTransition={true} />
        </div>
      </div>
    );
  };
};

export default CodeBlock;

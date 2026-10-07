import {
  createRef,
  FC,
  innerHTML,
  nextTick,
  observable,
  onBeforeMount,
  onMounted,
  onUpdated,
  ref,
  watch,
} from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useUnmounted } from '@/hooks/useUnmounted';
import { getShikiService } from '@/services/shiki';
import {
  isComposing,
  KeyBindingName,
  KeyBindingNameList,
  matchesShortcut,
} from '@/utils/keyboard-shortcut';

import * as styles from './ScriptEditor.styles';

export type ScriptEditorProps = {
  /** What the label beside it points its for at. */
  id: string;
  /** The script the document holds. */
  value: string;
  placeholder: string;
  theme: 'dark' | 'light';
  readonly: boolean;
  /** Called once per edit, as the field loses the focus, with the text it holds. */
  onCommit: (value: string) => void;
};

/** The editor's chords a script still hands on: find, the palette, Escape and the zoom. */
const SCRIPT_PASSING_BINDINGS: ReadonlyArray<KeyBindingName> = [
  KeyBindingName.findReplace,
  KeyBindingName.search,
  KeyBindingName.stop,
  KeyBindingName.zoomIn,
  KeyBindingName.zoomOut,
  KeyBindingName.zoomReset,
];

/**
 * A text field over its own highlighted text, left to right in any language as
 * the code block is, which commits what was typed as it loses the focus: one
 * action per edit. A change of the script meanwhile leaves the draft alone.
 */
const ScriptEditor: FC<ScriptEditorProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const textarea = createRef<HTMLTextAreaElement>();
  const preview = createRef<HTMLDivElement>();
  const { addUnsubscribe } = useUnmounted();

  const state = observable({
    draft: props.value,
    highlight: '',
    backgroundColor: '',
  });

  let focused = false;
  let unmounted = false;
  let highlightSource: string | null = null;
  let highlightRequestId = 0;

  // The field grows with its text, so the panel scrolls it rather than the field.
  const fitHeight = () => {
    const $textarea = textarea.value;
    if (!$textarea) return;

    $textarea.style.height = 'auto';
    $textarea.style.height = `${$textarea.scrollHeight}px`;
  };

  const getPre = () =>
    preview.value?.querySelector<HTMLPreElement>('pre.shiki') ?? null;

  const setBackgroundColor = () => {
    nextTick(() => {
      const pre = getPre();
      state.backgroundColor = pre?.style.backgroundColor ?? '';
      // shiki ships tabindex="0", a tab stop inside the aria-hidden preview
      pre?.removeAttribute('tabindex');
    });
  };

  const setHighlight = () => {
    const value = state.draft;
    const requestId = ++highlightRequestId;

    // stale markup would show another text than the field holds
    if (highlightSource !== value) {
      highlightSource = value;
      state.highlight = '';
    }

    getShikiService()
      ?.codeToHtml(value, { lang: 'sql', theme: props.theme })
      .then(highlight => {
        if (requestId !== highlightRequestId) return;

        state.highlight = highlight;
        setBackgroundColor();
      });
  };

  const commit = () => {
    if (state.draft !== props.value) {
      props.onCommit(state.draft);
    }
  };

  const handleInput = () => {
    const $textarea = textarea.value;
    if (!$textarea) return;

    state.draft = $textarea.value;
    fitHeight();
    setHighlight();
  };

  const handleFocus = () => {
    focused = true;
  };

  const handleBlur = () => {
    if (unmounted) return;

    focused = false;
    commit();
  };

  // the editor root turns a copy, a cut or a paste into a diagram's own
  const keepClipboard = (event: ClipboardEvent) => {
    event.stopPropagation();
  };

  /**
   * Keeps from the editor every chord but those it hands on, and a
   * composition, so the field takes its own undo, deletions and option
   * characters; nothing is prevented, so the field does what it would anywhere.
   */
  const handleKeydown = (event: KeyboardEvent) => {
    const { keyBindingMap } = app.value;
    const matches = (name: KeyBindingName) =>
      matchesShortcut(event, keyBindingMap[name]);

    if (
      isComposing(event) ||
      (!SCRIPT_PASSING_BINDINGS.some(matches) &&
        KeyBindingNameList.some(matches))
    ) {
      event.stopPropagation();
    }
  };

  onBeforeMount(() => {
    setHighlight();

    addUnsubscribe(
      watch(props).subscribe(propName => {
        if (propName === 'value' && !focused) {
          state.draft = props.value;
          setHighlight();
        } else if (propName === 'theme') {
          setHighlight();
        }
      }),
      () => {
        // a tab switched away by a chord takes the field without a blur
        unmounted = true;
        if (focused) commit();
      }
    );
  });

  onMounted(fitHeight);
  onUpdated(fitHeight);

  return () => (
    <div
      class={styles.editor}
      prop:dir="ltr"
      style={{
        'background-color': state.backgroundColor || 'var(--canvas-background)',
      }}
    >
      <textarea
        use:ref={ref(textarea)}
        class={styles.input}
        id={props.id}
        placeholder={props.placeholder}
        spellcheck="false"
        autocorrect="off"
        autocapitalize="off"
        autocomplete="off"
        aria-readonly={props.readonly ? 'true' : 'false'}
        prop:readOnly={props.readonly}
        prop:value={state.draft}
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeydown}
        on:copy={keepClipboard}
        on:cut={keepClipboard}
        on:paste={keepClipboard}
      ></textarea>
      <div class={styles.preview} aria-hidden="true" use:ref={ref(preview)}>
        {state.highlight ? innerHTML(state.highlight) : state.draft}
      </div>
    </div>
  );
};

export default ScriptEditor;

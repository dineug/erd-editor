// The script editor on a real keyboard and a real layout: the highlighted
// text it lays under the field wraps where the caret's does, an edit commits
// once, and the field keeps the editor's chords but those it hands on.

import {
  addCSSHost,
  createRef,
  FC,
  observable,
  ref,
  render,
  useProvider,
} from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import {
  type AppContext,
  appContext,
  useAppContext,
} from '@/components/appContext';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import ScriptEditor from '@/components/schema-sql/schema-sql-options/ScriptEditor';
import { themeContext } from '@/components/themeContext';
import { useKeyBindingMap } from '@/hooks/useKeyBindingMap';
import type { ShikiService } from '@/services/shiki';
import { hasAppleDevice } from '@/utils/device-detect';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

const mocks = vi.hoisted(() => ({
  getShikiService: vi.fn<() => ShikiService | null>(() => null),
}));

vi.mock('@/services/shiki', () => ({
  getShikiService: mocks.getShikiService,
}));

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Markup shaped as shiki's: a pre with its own colours, a span per line joined by line breaks. */
const fakeHighlight = async (text: string) =>
  `<pre class="shiki" style="background-color:#24292e;color:#e1e4e8" tabindex="0"><code>${text
    .split('\n')
    .map(
      line =>
        `<span class="line"><span style="color:#f97583">${escapeHtml(line)}</span></span>`
    )
    .join('\n')}</code></pre>`;

/** The key $mod names in the browser the spec runs in, which is what the bindings read too. */
const MOD = hasAppleDevice() ? 'Meta' : 'Control';

const state = observable({
  value: '',
  shown: true,
  readonly: false,
});

type Fixture = {
  app: AppContext;
  shadow: ShadowRoot;
  root: HTMLDivElement;
  textarea: () => HTMLTextAreaElement;
  preview: () => HTMLElement;
  next: () => HTMLButtonElement;
  onCommit: ReturnType<typeof vi.fn>;
};

const teardowns: Array<() => void> = [];

afterEach(() => {
  teardowns.splice(0).forEach(teardown => teardown());
  mocks.getShikiService.mockImplementation(() => null);
});

/** A panel column's width, where the script editor stands. */
const COLUMN_WIDTH = 259;

async function setup(value = ''): Promise<Fixture> {
  mocks.getShikiService.mockImplementation(
    () => ({ codeToHtml: fakeHighlight }) as unknown as ShikiService
  );
  Object.assign(state, { value, shown: true, readonly: false });

  const app = createTestAppContext();
  const onCommit = vi.fn((next: string) => {
    state.value = next;
  });

  /** The part of ErdEditor that reads the keyboard, around the editor and a control after it. */
  const Editor: FC = (_, ctx) => {
    const current = useAppContext(ctx);
    const root = createRef<HTMLDivElement>();
    useKeyBindingMap(ctx, root);

    return () => (
      <div
        class="root"
        use:ref={ref(root)}
        tabindex="-1"
        style={{ width: `${COLUMN_WIDTH}px` }}
        on:keydown={(event: KeyboardEvent) =>
          current.value.keydown$.next(event)
        }
      >
        {state.shown ? (
          <ScriptEditor
            id="script"
            value={state.value}
            placeholder="-- hint"
            theme="dark"
            readonly={state.readonly}
            onCommit={onCommit}
          />
        ) : null}
        <button type="button" class="next">
          next
        </button>
      </div>
    );
  };

  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  const globals = document.createElement('div');
  const container = document.createElement('div');
  shadow.append(globals, container);

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the casts; it is r-html's own, not a React hook.
  const providers = [
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    useProvider(container as any, appContext, app),
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    useProvider(container as any, themeContext, createTestTheme()),
  ];
  render(globals, <GlobalStyles />);
  render(container, <Editor />);
  await flush();

  teardowns.push(() => {
    render(container, null);
    render(globals, null);
    providers.forEach(provider => provider.destroy());
    host.remove();
    app.store.destroy();
  });

  return {
    app,
    shadow,
    root: shadow.querySelector('.root') as HTMLDivElement,
    textarea: () => shadow.querySelector('textarea') as HTMLTextAreaElement,
    preview: () =>
      shadow.querySelector('textarea + [aria-hidden="true"]') as HTMLElement,
    next: () => shadow.querySelector('.next') as HTMLButtonElement,
    onCommit,
  };
}

/** The height of the field's text alone: no minimum, no rows of its own, no padding. */
function fieldTextHeight(textarea: HTMLTextAreaElement): number {
  const { minHeight, height } = textarea.style;
  textarea.style.minHeight = '0px';
  textarea.style.height = '0px';
  const scrollHeight = textarea.scrollHeight;
  textarea.style.minHeight = minHeight;
  textarea.style.height = height;
  return scrollHeight - 16;
}

/** The height the preview's text takes, from its first line box to its last. */
function previewTextHeight(preview: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(preview);
  return range.getBoundingClientRect().height;
}

describe('ScriptEditor on a real layout', () => {
  it('wraps the highlighted text where the field wraps its own, line for line', async () => {
    const fixture = await setup();
    const samples = [
      'a',
      'SELECT 1;\nSELECT 2;',
      `INSERT INTO member (id, email) VALUES (1, '${'x'.repeat(80)}');`,
      'BEGIN\n\tNULL;\n\t\tEND;',
      `${'a_long_identifier_'.repeat(8)}\n${'-- '.repeat(40)}`,
    ];

    for (const sample of samples) {
      state.value = sample;
      await flush();
      await flush();

      expect(
        fixture.preview().querySelector('pre.shiki'),
        sample
      ).not.toBeNull();
      expect(
        Math.abs(
          fieldTextHeight(fixture.textarea()) -
            previewTextHeight(fixture.preview())
        ),
        sample
      ).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the field 110 px of text tall at least, the preview over the whole of it', async () => {
    const fixture = await setup();

    for (const sample of ['', 'a\n']) {
      state.value = sample;
      await flush();

      const field = fixture.textarea().getBoundingClientRect();
      const preview = fixture.preview().getBoundingClientRect();
      expect(field.height, JSON.stringify(sample)).toBe(110);
      expect([preview.top, preview.height]).toEqual([field.top, field.height]);
    }
  });

  it('grows with what is typed, so the panel scrolls rather than the field', async () => {
    const fixture = await setup();
    fixture.textarea().focus();

    await userEvent.keyboard(
      'a{Enter}b{Enter}c{Enter}d{Enter}e{Enter}f{Enter}g'
    );
    await flush();

    expect(fixture.textarea().getBoundingClientRect().height).toBe(7 * 18 + 16);
    expect(fixture.textarea().scrollTop).toBe(0);
  });

  it('keeps a scrolled panel where it was as a long script takes a key, the caret in sight', async () => {
    const lines = Array.from({ length: 60 }, (_, index) => `SELECT ${index};`);
    const fixture = await setup(lines.join('\n'));
    const { root } = fixture;
    // the panel's body, scrolling, with groups above and below the field
    Object.assign(root.style, {
      height: '400px',
      overflow: 'auto',
      paddingTop: '300px',
      paddingBottom: '120px',
    });
    const textarea = fixture.textarea();
    const caret = lines.slice(0, 50).join('\n').length;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
    root.scrollTop = root.scrollHeight;
    const scrollTop = root.scrollTop;
    expect(scrollTop).toBeGreaterThan(0);

    await userEvent.keyboard('x');
    await flush();
    await flush();

    expect(root.scrollTop).toBe(scrollTop);
    const view = root.getBoundingClientRect();
    const caretLine = textarea.getBoundingClientRect().top + 8 + 49 * 18;
    expect(caretLine).toBeGreaterThanOrEqual(view.top);
    expect(caretLine + 18).toBeLessThanOrEqual(view.bottom);
  });

  it('writes its placeholder in the code font the text takes', async () => {
    const fixture = await setup('');
    const textarea = fixture.textarea();

    expect(getComputedStyle(textarea, '::placeholder').fontFamily).toBe(
      getComputedStyle(textarea).fontFamily
    );
  });
});

describe('ScriptEditor commits', () => {
  it('once per edit, as the field loses the focus, and not for no change', async () => {
    const fixture = await setup('a');

    fixture.textarea().focus();
    fixture.textarea().blur();
    expect(fixture.onCommit).not.toHaveBeenCalled();

    fixture.textarea().focus();
    await userEvent.keyboard('bc');
    expect(fixture.onCommit).not.toHaveBeenCalled();
    fixture.textarea().blur();

    expect(fixture.onCommit).toHaveBeenCalledTimes(1);
    expect(fixture.onCommit).toHaveBeenCalledWith('abc');
  });

  it('once after a composition, never while it lasts', async () => {
    const fixture = await setup('');
    const textarea = fixture.textarea();
    textarea.focus();

    textarea.dispatchEvent(new CompositionEvent('compositionstart'));
    textarea.value = 'ㅎ';
    textarea.dispatchEvent(
      new InputEvent('input', { bubbles: true, isComposing: true })
    );
    expect(fixture.onCommit).not.toHaveBeenCalled();
    textarea.dispatchEvent(new CompositionEvent('compositionend'));
    textarea.value = '한';
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true }));
    textarea.blur();

    expect(fixture.onCommit).toHaveBeenCalledTimes(1);
    expect(fixture.onCommit).toHaveBeenCalledWith('한');
  });

  it('keeps the draft through a change of the script while focused, and follows one after', async () => {
    const fixture = await setup('a');
    fixture.textarea().focus();
    await userEvent.keyboard('b');

    state.value = 'from a peer';
    await flush();
    expect(fixture.textarea().value).toBe('ab');

    fixture.textarea().blur();
    state.value = 'from an agent';
    await flush();
    expect(fixture.textarea().value).toBe('from an agent');
  });

  it("takes the document's script as it loses the focus untyped, committing nothing back over it", async () => {
    const fixture = await setup('a');
    fixture.textarea().focus();

    state.value = 'from an agent';
    await flush();
    fixture.textarea().blur();
    await flush();

    expect(fixture.onCommit).not.toHaveBeenCalled();
    expect(state.value).toBe('from an agent');
    expect(fixture.textarea().value).toBe('from an agent');
  });

  it('commits what was typed when it goes while focused, as a tab switched by a chord takes it', async () => {
    const fixture = await setup('a');
    fixture.textarea().focus();
    await userEvent.keyboard('b');

    state.shown = false;
    await flush();

    expect(fixture.onCommit).toHaveBeenCalledTimes(1);
    expect(fixture.onCommit).toHaveBeenCalledWith('ab');
  });

  it('keeps a paste from the editor root, which would paste a diagram', async () => {
    const fixture = await setup('');
    const behind = vi.fn();
    fixture.root.addEventListener('paste', behind);

    const paste = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    fixture.textarea().dispatchEvent(paste);

    expect(behind).not.toHaveBeenCalled();
    expect(paste.defaultPrevented).toBe(false);
  });
});

describe('ScriptEditor on a real keyboard', () => {
  /** Every keydown the field took, and every one that reached the root and every chord the root read. */
  function record(fixture: Fixture) {
    const pressed: KeyboardEvent[] = [];
    const reached: KeyboardEvent[] = [];
    const chords: KeyBindingName[] = [];
    fixture
      .textarea()
      .addEventListener('keydown', event => pressed.push(event));
    fixture.root.addEventListener('keydown', event => reached.push(event));
    const subscription = fixture.app.shortcut$.subscribe(({ type }) =>
      chords.push(type)
    );
    teardowns.push(() => subscription.unsubscribe());
    return { pressed, reached, chords };
  }

  it('keeps undo, redo, the deletions and the option characters in the field, unprevented', async () => {
    const fixture = await setup('one two');
    const { pressed, reached, chords } = record(fixture);
    fixture.textarea().focus();

    for (const keys of [
      `{${MOD}>}z{/${MOD}}`,
      `{${MOD}>}{Shift>}z{/Shift}{/${MOD}}`,
      `{${MOD}>}{Backspace}{/${MOD}}`,
      '{Alt>}{Backspace}{/Alt}',
      '{Alt>}{Delete}{/Alt}',
      '{Alt>}n{/Alt}',
      '{Alt>}{Enter}{/Alt}',
    ]) {
      await userEvent.keyboard(keys);
    }
    await flush();

    const chordsPressed = pressed.filter(
      event => !['Meta', 'Control', 'Shift', 'Alt'].includes(event.key)
    );
    expect(chordsPressed).toHaveLength(7);
    expect(chordsPressed.map(event => event.defaultPrevented)).toEqual(
      Array(7).fill(false)
    );
    expect(reached.filter(event => chordsPressed.includes(event))).toEqual([]);
    expect(chords).toEqual([]);
  });

  it('hands the palette and Escape on to the editor', async () => {
    const fixture = await setup('');
    const { chords } = record(fixture);
    fixture.textarea().focus();

    await userEvent.keyboard(`{${MOD}>}k{/${MOD}}`);
    await userEvent.keyboard('{Escape}');

    expect(chords).toEqual([KeyBindingName.search, KeyBindingName.stop]);
  });

  it('keeps a composing keydown from the editor', async () => {
    const fixture = await setup('');
    const { reached } = record(fixture);

    const composing = new KeyboardEvent('keydown', {
      key: 'Process',
      code: 'KeyG',
      bubbles: true,
      cancelable: true,
      composed: true,
      isComposing: true,
    });
    fixture.textarea().dispatchEvent(composing);

    expect(reached).not.toContain(composing);
  });

  it('moves the focus on with Tab, typing no indent', async () => {
    const fixture = await setup('a');
    fixture.textarea().focus();

    await userEvent.keyboard('{Tab}');

    expect(fixture.shadow.activeElement).toBe(fixture.next());
    expect(fixture.textarea().value).toBe('a');
  });

  it('takes no typing while readonly', async () => {
    const fixture = await setup('a');
    state.readonly = true;
    await flush();
    fixture.textarea().focus();

    await userEvent.keyboard('bc');
    fixture.textarea().blur();

    expect(fixture.textarea().value).toBe('a');
    expect(fixture.onCommit).not.toHaveBeenCalled();
  });
});

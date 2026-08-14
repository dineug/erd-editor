import { FC, html, observable } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import EditInput, {
  EditInputProps,
} from '@/components/primitives/edit-input/EditInput';
import * as styles from '@/components/primitives/edit-input/EditInput.styles';
import { InternalEventType } from '@/utils/internalEvents';

type State = {
  class?: any;
  placeholder?: string;
  title?: string;
  edit: boolean;
  focus: boolean;
  width: number;
  value: string;
  autofocus?: boolean;
};

type Handlers = Pick<EditInputProps, 'onInput' | 'onBlur' | 'onKeydown'>;

type HostProps = {
  state: State;
  handlers: Handlers;
};

const Host: FC<HostProps> = (props, ctx) => () => html`
  <${EditInput}
    class=${props.state.class}
    placeholder=${props.state.placeholder}
    title=${props.state.title}
    edit=${props.state.edit}
    focus=${props.state.focus}
    width=${props.state.width}
    value=${props.state.value}
    autofocus=${props.state.autofocus}
    .onInput=${props.handlers.onInput}
    .onBlur=${props.handlers.onBlur}
    .onKeydown=${props.handlers.onKeydown}
  />
`;

let mounted: Mounted | null = null;
let focusEvents = 0;

const countFocusEvent = () => {
  focusEvents++;
};

afterEach(() => {
  document.body.removeEventListener(InternalEventType.focus, countFocusEvent);
  mounted?.unmount();
  mounted = null;
});

async function setup(partial: Partial<State> = {}, handlers: Handlers = {}) {
  const state = observable<State>({
    edit: false,
    focus: false,
    width: 120,
    value: 'users',
    ...partial,
  });

  focusEvents = 0;
  document.body.addEventListener(InternalEventType.focus, countFocusEvent);

  mounted = await mountAndFlush(
    html`<${Host} state=${state} handlers=${handlers} />`
  );

  const el = () =>
    mounted?.container.querySelector('.edit-input') as HTMLElement;

  return { state, el };
}

describe('EditInput', () => {
  describe('read only rendering', () => {
    it('renders a div carrying the base, cursor and user-select classes', async () => {
      const { el } = await setup();
      const div = el();

      expect(div.tagName).toBe('DIV');
      expect(div.classList.contains('edit-input')).toBe(true);
      expect(div.classList.contains(String(styles.root))).toBe(true);
      expect(div.classList.contains(String(styles.cursor))).toBe(true);
      expect(div.classList.contains(String(styles.userSelect))).toBe(true);
    });

    it('renders the value inside an ellipsis span', async () => {
      const { el } = await setup({ value: 'users' });
      const span = el().querySelector('span') as HTMLSpanElement;

      expect(span.classList.contains(String(styles.ellipsis))).toBe(true);
      expect(span.textContent?.trim()).toBe('users');
    });

    it('falls back to the placeholder text when the value is blank', async () => {
      const { el } = await setup({ value: '   ', placeholder: 'table name' });

      expect(el().textContent?.trim()).toBe('table name');
    });

    it('marks a blank value with the placeholder class', async () => {
      const { el } = await setup({ value: '' });

      expect(el().classList.contains('placeholder')).toBe(true);
    });

    it('does not mark a filled value with the placeholder class', async () => {
      const { el } = await setup({ value: 'users' });

      expect(el().classList.contains('placeholder')).toBe(false);
    });

    it('adds the focus class and the focus border flag when focused', async () => {
      const { el } = await setup({ focus: true });

      expect(el().classList.contains('focus')).toBe(true);
      expect(el().classList.contains('edit')).toBe(false);
      expect(el().hasAttribute('data-focus-border-bottom')).toBe(true);
    });

    it('drops the focus border flag when neither focused nor editing', async () => {
      const { el } = await setup();

      expect(el().classList.contains('focus')).toBe(false);
      expect(el().hasAttribute('data-focus-border-bottom')).toBe(false);
    });

    it('pins both width and min-width to the width prop', async () => {
      const { el } = await setup({ width: 88 });

      expect(el().style.width).toBe('88px');
      expect(el().style.minWidth).toBe('88px');
    });

    it('renders the title attribute only when it has a value', async () => {
      const withTitle = await setup({ title: 'table name' });
      expect(withTitle.el().getAttribute('title')).toBe('table name');

      mounted?.unmount();
      mounted = null;

      const withoutTitle = await setup({ title: '' });
      expect(withoutTitle.el().hasAttribute('title')).toBe(false);
    });

    it('merges the extra class prop into the element', async () => {
      const { el } = await setup({ class: ['custom-input'] });

      expect(el().classList.contains('custom-input')).toBe(true);
    });
  });

  describe('edit rendering', () => {
    it('renders a text input carrying the edit class', async () => {
      const { el } = await setup({ edit: true });
      const input = el() as HTMLInputElement;

      expect(input.tagName).toBe('INPUT');
      expect(input.getAttribute('type')).toBe('text');
      expect(input.getAttribute('spellcheck')).toBe('false');
      expect(input.classList.contains('edit')).toBe(true);
      expect(input.classList.contains(String(styles.root))).toBe(true);
    });

    it('never carries the read only cursor / user-select classes', async () => {
      const { el } = await setup({ edit: true, value: '', focus: true });

      expect(el().classList.contains(String(styles.cursor))).toBe(false);
      expect(el().classList.contains(String(styles.userSelect))).toBe(false);
      expect(el().classList.contains('placeholder')).toBe(false);
      expect(el().classList.contains('focus')).toBe(false);
    });

    it('always flags the focus border while editing', async () => {
      const { el } = await setup({ edit: true, focus: false });

      expect(el().hasAttribute('data-focus-border-bottom')).toBe(true);
    });

    it('binds the value as a property', async () => {
      const { el } = await setup({ edit: true, value: 'users' });

      expect((el() as HTMLInputElement).value).toBe('users');
      expect(el().hasAttribute('value')).toBe(false);
    });

    it('falls back to an empty string when the value prop is nullish', async () => {
      const { el } = await setup({ edit: true, value: undefined as any });

      expect((el() as HTMLInputElement).value).toBe('');
    });

    it('renders the placeholder and title attributes when present', async () => {
      const { el } = await setup({
        edit: true,
        placeholder: 'table name',
        title: 'table name',
      });

      expect(el().getAttribute('placeholder')).toBe('table name');
      expect(el().getAttribute('title')).toBe('table name');
    });

    it('pins both width and min-width to the width prop', async () => {
      const { el } = await setup({ edit: true, width: 64 });

      expect(el().style.width).toBe('64px');
      expect(el().style.minWidth).toBe('64px');
    });
  });

  describe('event handlers', () => {
    it('forwards input events', async () => {
      const onInput = vi.fn();
      const { el } = await setup({ edit: true }, { onInput });

      el().dispatchEvent(new Event('input'));

      expect(onInput).toHaveBeenCalledTimes(1);
    });

    it('forwards keydown events', async () => {
      const onKeydown = vi.fn();
      const { el } = await setup({ edit: true }, { onKeydown });

      el().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(onKeydown).toHaveBeenCalledTimes(1);
      expect(onKeydown.mock.calls[0][0].key).toBe('Enter');
    });

    it('forwards blur and then announces an internal focus event', async () => {
      const onBlur = vi.fn();
      const { el } = await setup({ edit: true }, { onBlur });

      el().dispatchEvent(new FocusEvent('blur'));

      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(focusEvents).toBe(1);
    });

    it('still announces the internal focus event without an onBlur prop', async () => {
      const { el } = await setup({ edit: true });

      el().dispatchEvent(new FocusEvent('blur'));

      expect(focusEvents).toBe(1);
    });
  });

  describe('reacting to the edit prop', () => {
    it('swaps the div for an input and focuses it with the caret at the end', async () => {
      const { state, el } = await setup({ edit: false, value: 'users' });
      expect(el().tagName).toBe('DIV');

      state.edit = true;
      await flush();

      const input = el() as HTMLInputElement;
      expect(input.tagName).toBe('INPUT');
      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(5);
      expect(input.selectionEnd).toBe(5);
    });

    it('announces an internal focus event when editing ends', async () => {
      const { state, el } = await setup({ edit: true, value: 'users' });
      focusEvents = 0;

      state.edit = false;
      await flush();

      expect(el().tagName).toBe('DIV');
      expect(focusEvents).toBe(1);
    });

    it('does not announce a focus event when editing starts', async () => {
      const { state } = await setup({ edit: false });
      focusEvents = 0;

      state.edit = true;
      await flush();

      expect(focusEvents).toBe(0);
    });

    it('ignores prop changes other than edit', async () => {
      const { state, el } = await setup({ edit: false, value: 'users' });
      focusEvents = 0;

      state.value = 'orders';
      state.focus = true;
      await flush();

      expect(el().textContent?.trim()).toBe('orders');
      expect(el().classList.contains('focus')).toBe(true);
      expect(focusEvents).toBe(0);
      expect(document.activeElement).not.toBe(el());
    });

    it('keeps the caret untouched while only the value changes in edit mode', async () => {
      const { state, el } = await setup({ edit: true, value: 'users' });
      const input = el() as HTMLInputElement;
      input.blur();
      focusEvents = 0;

      state.value = 'orders';
      await flush();

      expect((el() as HTMLInputElement).value).toBe('orders');
      expect(document.activeElement).not.toBe(el());
    });
  });

  describe('autofocus', () => {
    it('focuses the input on mount when editing', async () => {
      const { el } = await setup({ edit: true, value: 'ab', autofocus: true });
      await flush();

      expect(document.activeElement).toBe(el());
      expect((el() as HTMLInputElement).selectionStart).toBe(2);
    });

    it('has nothing to focus when mounted outside edit mode', async () => {
      const { el } = await setup({ edit: false, autofocus: true });
      await flush();

      expect(el().tagName).toBe('DIV');
      expect(document.activeElement).not.toBe(el());
    });

    it('does not focus on mount when autofocus is off', async () => {
      const { el } = await setup({ edit: true, autofocus: false });
      await flush();

      expect(document.activeElement).not.toBe(el());
    });
  });
});

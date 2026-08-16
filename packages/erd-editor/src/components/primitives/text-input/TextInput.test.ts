import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import TextInput, {
  TextInputProps,
} from '@/components/primitives/text-input/TextInput';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function setup(props: Partial<TextInputProps> = {}) {
  mounted = await mountAndFlush(
    html`<${TextInput}
      class=${props.class}
      title=${props.title}
      placeholder=${props.placeholder}
      readonly=${props.readonly}
      disabled=${props.disabled}
      width=${props.width}
      value=${props.value as string}
      numberOnly=${props.numberOnly}
      autofocus=${props.autofocus}
      .onInput=${props.onInput}
      .onChange=${props.onChange}
      .onBlur=${props.onBlur}
      .onKeyup=${props.onKeyup}
      .onKeydown=${props.onKeydown}
    />`
  );

  return mounted.container.querySelector('input') as HTMLInputElement;
}

describe('TextInput', () => {
  it('renders a non spellchecked text input', async () => {
    const input = await setup({ value: '' });

    expect(input).toBeTruthy();
    expect(input.getAttribute('type')).toBe('text');
    expect(input.getAttribute('spellcheck')).toBe('false');
  });

  it('binds the value as a property rather than an attribute', async () => {
    const input = await setup({ value: 'users' });

    expect(input.value).toBe('users');
    expect(input.hasAttribute('value')).toBe(false);
  });

  it('falls back to an empty string when the value prop is nullish', async () => {
    const input = await setup({ value: undefined as any });

    expect(input.value).toBe('');
  });

  it('applies an array class prop', async () => {
    const input = await setup({ value: '', class: ['my-input', 'wide'] });

    expect(input.classList.contains('my-input')).toBe(true);
    expect(input.classList.contains('wide')).toBe(true);
  });

  it('applies only the truthy keys of an object class prop', async () => {
    const input = await setup({
      value: '',
      class: { on: true, off: false },
    });

    expect(input.classList.contains('on')).toBe(true);
    expect(input.classList.contains('off')).toBe(false);
  });

  it('silently ignores a plain string class prop', async () => {
    const input = await setup({ value: '', class: 'my-input' });

    expect(input.hasAttribute('class')).toBe(false);
  });

  it('renders no class attribute when the class prop is omitted', async () => {
    const input = await setup({ value: '' });

    expect(input.hasAttribute('class')).toBe(false);
  });

  it('turns the width prop into a pixel width', async () => {
    const input = await setup({ value: '', width: 140 });

    expect(input.style.width).toBe('140px');
  });

  it('leaves the width unset when the prop is omitted', async () => {
    const input = await setup({ value: '' });

    expect(input.style.width).toBe('');
  });

  it('renders title and placeholder when they carry a value', async () => {
    const input = await setup({
      value: '',
      title: 'column name',
      placeholder: 'name',
    });

    expect(input.getAttribute('title')).toBe('column name');
    expect(input.getAttribute('placeholder')).toBe('name');
  });

  it('omits title and placeholder attributes for nullish or empty values', async () => {
    const input = await setup({ value: '', title: '', placeholder: undefined });

    expect(input.hasAttribute('title')).toBe(false);
    expect(input.hasAttribute('placeholder')).toBe(false);
  });

  it('renders the readonly and disabled boolean attributes when enabled', async () => {
    const input = await setup({ value: '', readonly: true, disabled: true });

    expect(input.hasAttribute('readonly')).toBe(true);
    expect(input.hasAttribute('disabled')).toBe(true);
  });

  it('drops the readonly and disabled attributes when they are false', async () => {
    const input = await setup({ value: '', readonly: false, disabled: false });

    expect(input.hasAttribute('readonly')).toBe(false);
    expect(input.hasAttribute('disabled')).toBe(false);
  });

  describe('event handlers', () => {
    it('forwards input events', async () => {
      const onInput = vi.fn();
      const input = await setup({ value: '', onInput });

      input.value = 'a';
      input.dispatchEvent(new Event('input'));

      expect(onInput).toHaveBeenCalledTimes(1);
    });

    it('forwards change events', async () => {
      const onChange = vi.fn();
      const input = await setup({ value: '', onChange });

      input.dispatchEvent(new Event('change'));

      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('forwards blur events', async () => {
      const onBlur = vi.fn();
      const input = await setup({ value: '', onBlur });

      input.dispatchEvent(new FocusEvent('blur'));

      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('forwards keyup and keydown events', async () => {
      const onKeyup = vi.fn();
      const onKeydown = vi.fn();
      const input = await setup({ value: '', onKeyup, onKeydown });

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));

      expect(onKeydown).toHaveBeenCalledTimes(1);
      expect(onKeyup).toHaveBeenCalledTimes(1);
      expect(onKeydown.mock.calls[0][0].key).toBe('Enter');
    });
  });

  describe('numberOnly', () => {
    it('strips every non digit from the typed value before onInput runs', async () => {
      const seen: string[] = [];
      const input = await setup({
        value: '',
        numberOnly: true,
        onInput: event => seen.push((event.target as HTMLInputElement).value),
      });

      input.value = '12a3-b';
      input.dispatchEvent(new Event('input'));

      expect(input.value).toBe('123');
      expect(seen).toEqual(['123']);
    });

    it('leaves the typed value untouched when numberOnly is off', async () => {
      const input = await setup({ value: '', numberOnly: false });

      input.value = '12a3';
      input.dispatchEvent(new Event('input'));

      expect(input.value).toBe('12a3');
    });
  });

  describe('autofocus', () => {
    it('focuses the input and parks the caret at the end on mount', async () => {
      const input = await setup({ value: 'hello', autofocus: true });
      await flush();

      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(5);
      expect(input.selectionEnd).toBe(5);
    });

    it('does not steal focus when autofocus is not set', async () => {
      const input = await setup({ value: 'hello' });
      await flush();

      expect(document.activeElement).not.toBe(input);
    });
  });
});

import '@/erd-editor';

import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import {
  defineErdEditor,
  ErdEditorElement,
} from '@/components/erd-editor/ErdEditor';
import * as index from '@/index';

describe('@dineug/erd-editor/erd-editor.js', () => {
  it('defines <erd-editor> as the exported class', () => {
    expect(customElements.get('erd-editor')).toBe(ErdEditorElement);
  });

  it('upgrades a created element into the defined class', () => {
    const editor = document.createElement('erd-editor');

    expect(editor).toBeInstanceOf(ErdEditorElement);
    expect(editor).toBeInstanceOf(HTMLElement);
    expect(editor.tagName.toLowerCase()).toBe('erd-editor');
    expectTypeOf(editor).toEqualTypeOf<ErdEditorElement>();
  });

  it('constructs the class with new once the tag is defined', () => {
    const editor = new ErdEditorElement();

    expect(editor).toBeInstanceOf(ErdEditorElement);
    expect(editor.tagName.toLowerCase()).toBe('erd-editor');
    expect(editor.setInitialValue).toBeTypeOf('function');
    expectTypeOf(editor).toEqualTypeOf<ErdEditorElement>();
    expectTypeOf<
      InstanceType<typeof ErdEditorElement>
    >().toEqualTypeOf<ErdEditorElement>();
  });

  it('creates an element that implements the editor API', () => {
    const editor = document.createElement('erd-editor');

    expect(editor.focus).toBeTypeOf('function');
    expect(editor.blur).toBeTypeOf('function');
    expect(editor.clear).toBeTypeOf('function');
    expect(editor.destroy).toBeTypeOf('function');
    expect(editor.setInitialValue).toBeTypeOf('function');
    expect(editor.setKeyBindingMap).toBeTypeOf('function');
    expect(editor.setLocale).toBeTypeOf('function');
    expect(editor.setSystemLocale).toBeTypeOf('function');
    expect(editor.getSchemaSQL).toBeTypeOf('function');
  });

  it('observes the boolean props declared by the editor', () => {
    expect(ErdEditorElement.observedAttributes).toEqual(
      expect.arrayContaining([
        'readonly',
        'system-dark-mode',
        'enable-theme-builder',
        'enable-locale-picker',
        'enable-welcome-screen',
      ])
    );
  });

  it('leaves the definition as it is when defineErdEditor runs again', () => {
    expect(() => defineErdEditor()).not.toThrow();
    expect(() => defineErdEditor()).not.toThrow();
    expect(customElements.get('erd-editor')).toBe(ErdEditorElement);
  });

  it('shares its class with the package root, whose defineErdEditor is then quiet too', () => {
    expect(index.ErdEditorElement).toBe(ErdEditorElement);
    expect(() => index.defineErdEditor()).not.toThrow();
    expect(customElements.get('erd-editor')).toBe(ErdEditorElement);
    expect(customElements.get('erd-viewer')).toBeUndefined();
  });
});

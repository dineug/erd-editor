import '@/erd-editor';

import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import {
  defineErdEditor,
  ErdEditorElement,
} from '@/components/erd-editor/ErdEditor';

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
});

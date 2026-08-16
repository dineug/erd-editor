import '@/components/customElementRegistry';

import { describe, expect, it } from 'vite-plus/test';

describe('customElementRegistry', () => {
  it('registers the <erd-editor> custom element', () => {
    expect(customElements.get('erd-editor')).toBeTypeOf('function');
  });

  it('upgrades a created element into the registered class', () => {
    const ErdEditorElement = customElements.get('erd-editor')!;
    const el = document.createElement('erd-editor');

    expect(el).toBeInstanceOf(ErdEditorElement);
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.tagName.toLowerCase()).toBe('erd-editor');
  });

  it('observes the boolean props declared by the editor', () => {
    const ErdEditorElement = customElements.get('erd-editor') as any;

    expect(ErdEditorElement.observedAttributes).toEqual(
      expect.arrayContaining(['readonly', 'system-dark-mode'])
    );
  });

  it('is idempotent when imported more than once', async () => {
    const before = customElements.get('erd-editor');
    await import('@/components/customElementRegistry');

    expect(customElements.get('erd-editor')).toBe(before);
  });
});

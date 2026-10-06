// A document that an element empties as it is destroyed must not raise the
// welcome screen over a provider that is already gone.

import '@/index';

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush } from '@/__test-utils__';
import { whenDrawn } from '@/konva/batchDraw';

afterEach(async () => {
  document.body.replaceChildren();
  await whenDrawn();
});

describe('WelcomeScreen on an element being destroyed', () => {
  it('raises no welcome screen error when a removed element is destroyed and its document empties', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const editor = document.createElement('erd-editor');
      editor.enableWelcomeScreen = true;
      editor.style.cssText = 'display: block; width: 900px; height: 600px;';
      document.body.append(editor);
      await editor.setSchemaSQL('CREATE TABLE a (id int);');
      await flush();
      await whenDrawn();

      editor.remove();
      editor.destroy();
      await flush();
      await whenDrawn();

      expect(error.mock.calls.map(call => String(call[0]))).toEqual([]);
    } finally {
      error.mockRestore();
    }
  });
});

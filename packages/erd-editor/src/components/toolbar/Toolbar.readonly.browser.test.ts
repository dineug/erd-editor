// A readonly editor's toolbar in a real element over a document whose locks are
// off: every tab opens on the reader's screen alone, and nothing the bar takes
// reaches the document, a peer or the change event.

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import {
  closeReadonlyEditors,
  drawn,
  openReadonlyEditor,
  type ReadonlyEditor,
} from '@/__test-utils__/readonlyEditor';
import * as settingsStyles from '@/components/settings/Settings.styles';
import { CanvasType } from '@/constants/schema';

// The code tabs' highlighter is a shared worker whose shiki modules the dev
// server would discover mid-run and reload every spec for; plain text will do.
vi.mock('@/services/shiki', () => ({ getShikiService: () => null }));

afterEach(() => {
  closeReadonlyEditors();
});

/** Each tab's button title and what only that tab draws. */
const TABS = [
  ['Visualization', '.visualization-toolbar'],
  ['Schema SQL', '.schema-sql-options'],
  ['Code Generator', '.generator-code-options'],
  ['Dictionary', '.dictionary'],
  ['Settings', `.${String(settingsStyles.root)}`],
  ['Entity Relationship Diagram', '[data-testid="erd-canvas"]'],
] as const;

const buttonOf = ({ shadow }: ReadonlyEditor, title: string) =>
  shadow.querySelector<HTMLElement>(`.toolbar [title="${title}"]`)!;

const documentCanvasType = ({ el }: ReadonlyEditor) =>
  JSON.parse(el.value).settings.canvasType;

describe("a readonly editor's toolbar over a document with its locks off", () => {
  it('opens every tab on this screen alone, with no Undo, Redo or Time Travel on any', async () => {
    const editor = await openReadonlyEditor();
    const { shadow } = editor;

    expect(shadow.querySelector('.toolbar > input')).toBeNull();
    expect(
      shadow.querySelector('.toolbar')!.firstElementChild!.textContent?.trim()
    ).toBe('shop');

    for (const [title, drawnOnly] of TABS) {
      await editor.openTab(title);

      expect(buttonOf(editor, title).classList.contains('active'), title).toBe(
        true
      );
      expect(shadow.querySelector(drawnOnly), title).not.toBeNull();
      expect(shadow.querySelectorAll('.undo-redo'), title).toHaveLength(0);
      expect(documentCanvasType(editor), title).toBe(CanvasType.ERD);
    }
    await editor.expectDocumentKept();
  });

  it('opens the palette and the Explorer from the bar, the document left as it was', async () => {
    const editor = await openReadonlyEditor();
    const { shadow } = editor;

    await userEvent.click(shadow.querySelector('.toolbar-search')!);
    await drawn();
    expect(shadow.querySelector('.quick-search')).not.toBeNull();
    await userEvent.keyboard('{Escape}');
    await drawn();
    expect(shadow.querySelector('.quick-search')).toBeNull();

    const explorer = shadow.querySelector<HTMLElement>('.toolbar-explorer')!;
    await userEvent.click(explorer);
    await drawn();
    expect(explorer.classList.contains('active')).toBe(true);
    await userEvent.click(explorer);
    await drawn();
    expect(explorer.classList.contains('active')).toBe(false);

    await editor.expectDocumentKept();
  });
});

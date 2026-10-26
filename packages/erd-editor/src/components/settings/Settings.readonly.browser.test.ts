// A readonly editor's Settings tab in a real element over a document whose
// locks are off, so no setting is held by a lock: each control a reader can
// reach changes nothing on the screen, in the document or at a peer.

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import {
  closeReadonlyEditors,
  drawn,
  openReadonlyEditor,
} from '@/__test-utils__/readonlyEditor';
import * as tablePropertiesStyles from '@/components/erd/table-properties/TableProperties.styles';
import * as styles from '@/components/settings/Settings.styles';
import * as lnbStyles from '@/components/settings/settings-lnb/SettingsLnb.styles';
import { Language } from '@/constants/schema';

// The code tab's highlighter is a shared worker whose shiki modules the dev
// server would discover mid-run and reload every spec for; plain text will do.
vi.mock('@/services/shiki', () => ({ getShikiService: () => null }));

afterEach(() => {
  closeReadonlyEditors();
});

const all = <T extends Element>(root: ParentNode, selector: string) =>
  Array.from(root.querySelectorAll<T>(selector));

/** A click dispatched on the control itself, past the refusal a disabled one gives a real press. */
const press = (el: Element) =>
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

/** An event as the control would fire it, which stays inside the shadow root as a change does. */
const fire = (el: Element, type: string) =>
  el.dispatchEvent(new Event(type, { bubbles: true }));

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Everything the Preferences page shows of the settings, in the order drawn. */
function shownSettings(root: ParentNode) {
  return {
    switches: all(root, `.${styles.row} [role="switch"]`).map(button =>
      button.getAttribute('aria-checked')
    ),
    width: root.querySelector<HTMLInputElement>(
      'input[title="Maximum comment width"]'
    )!.value,
    locks: all(root, `.${styles.lockRow}`).map(row => [
      row.querySelector(`.${styles.lockValue}`)!.textContent?.trim(),
      row.querySelector('button')!.getAttribute('aria-pressed'),
    ]),
    columnOrder: all(root, `.${styles.columnOrderItem}`).map(item =>
      item.textContent?.trim()
    ),
  };
}

/** Draws the Preferences page anew from what the store holds, by way of the Shortcuts page. */
async function redrawPreferences(root: ParentNode) {
  const [preferences, shortcuts] = all<HTMLElement>(root, `.${lnbStyles.item}`);

  await userEvent.click(shortcuts);
  await drawn();
  expect(root.querySelector(`.${styles.lockRow}`)).toBeNull();
  await userEvent.click(preferences);
  await drawn();
}

describe("a readonly editor's Settings tab over a document with its locks off", () => {
  it('takes every control a reader reaches and changes nothing, on the screen, in the document or at a peer', async () => {
    const editor = await openReadonlyEditor();
    await editor.openTab('Settings');
    const root = editor.shadow.querySelector(`.${styles.root}`)!;
    const before = shownSettings(root);

    expect(
      root
        .querySelector(`.${String(tablePropertiesStyles.readonlyBadge)}`)
        ?.textContent?.trim()
    ).toBe('Read only');
    expect(before.switches).toEqual(['false', 'true']);
    expect(before.width).toBe('120px');
    expect(before.locks.map(([, pressed]) => pressed)).toEqual(
      Array(7).fill('false')
    );

    all(root, `.${styles.row} [role="switch"]`).forEach(press);
    const width = root.querySelector<HTMLInputElement>(
      'input[title="Maximum comment width"]'
    )!;
    width.value = '150';
    fire(width, 'change');
    all(root, `.${styles.lockRow} button`).forEach(press);
    const items = all(root, `.${styles.columnOrderItem}`);
    fire(items[0], 'dragstart');
    fire(items[2], 'dragover');
    await wait(120);
    fire(items[0], 'dragend');
    await redrawPreferences(root);

    expect(shownSettings(root)).toEqual(before);
    await editor.expectDocumentKept();
  });

  it("shows on an unlocked row the language this reader's screen turned to, the document keeping its own", async () => {
    const editor = await openReadonlyEditor();
    await editor.openTab('Code Generator');
    const language = editor.shadow.querySelector<HTMLSelectElement>(
      '#generator-code-language'
    )!;
    language.value = String(Language.Kotlin);
    fire(language, 'change');
    await drawn();

    await editor.openTab('Settings');
    const root = editor.shadow.querySelector(`.${styles.root}`)!;
    const row = all(root, `.${styles.lockRow}`).find(
      lockRow =>
        lockRow.querySelector(`.${styles.lockName}`)?.textContent?.trim() ===
        'Language'
    )!;

    expect(row.querySelector(`.${styles.lockValue}`)!.textContent?.trim()).toBe(
      'Kotlin'
    );
    expect(
      row.querySelector(`.${styles.lockValue}`)!.hasAttribute('data-locked')
    ).toBe(false);
    expect(JSON.parse(editor.el.value).settings.language).toBe(
      Language.TypeScript
    );
    await editor.expectDocumentKept();
  });
});

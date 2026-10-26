// An element a host moves in the page, as Obsidian does when a tab goes to a
// split or a popout, disconnects and connects again. The selection and the
// focus a jump left stay through the move, readonly or not.

import type { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import { drawn, openLockOffEditor } from '@/__test-utils__/readonlyEditor';
import {
  sharedFocusTrackerAction,
  sharedSelectionTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, type SharedFocus } from '@/engine/modules/editor/state';

const teardowns: Array<() => void> = [];

afterEach(() => {
  teardowns.splice(0).forEach(teardown => teardown());
});

/** An editor over the lock-off seed and the selections and focuses its shared store sends. */
async function openEditor(readonly: boolean) {
  const el = await openLockOffEditor({ readonly });

  const sharedStore = el.getSharedStore({
    mouseTracker: false,
    focusTracker: true,
  });
  const selections: string[][] = [];
  const focuses: Array<SharedFocus | null> = [];
  const unsubscribe = sharedStore.subscribe(actions =>
    actions.forEach(({ type, payload }: AnyAction) => {
      if (type === sharedSelectionTrackerAction.type) {
        selections.push(payload.selectedIds);
      }
      if (type === sharedFocusTrackerAction.type) {
        focuses.push(payload.focus);
      }
    })
  );
  teardowns.push(() => {
    unsubscribe();
    sharedStore.destroy();
    el.remove();
  });

  return { el, shadow: el.shadowRoot as ShadowRoot, selections, focuses };
}

/** Past the outbound pipe's throttle on presence, so the last selection and focus it sent stand. */
const pastTheThrottle = () => new Promise(resolve => setTimeout(resolve, 260));

/** What a jump to the users table leaves: the table selected and its name focused. */
const JUMPED = {
  selection: ['users'],
  focus: { tableId: 'users', columnId: null, focusType: FocusType.tableName },
};

describe('<erd-editor> moved in the page', () => {
  it.each([
    ['readonly', true],
    ['writable', false],
  ])(
    'keeps the selection and the focus a jump left, %s',
    async (_label, readonly) => {
      const { el, shadow, selections, focuses } = await openEditor(readonly);
      const standing = () => ({
        selection: selections.at(-1),
        focus: focuses.at(-1),
      });

      await userEvent.click(shadow.querySelector('.toolbar-search')!);
      await drawn();
      const input = shadow.querySelector<HTMLInputElement>(
        '.quick-search input'
      )!;
      input.value = '#users';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await drawn();
      await userEvent.click(shadow.querySelector('.quick-search-row')!);
      await drawn();
      await pastTheThrottle();
      expect(standing()).toEqual(JUMPED);

      el.remove();
      await drawn();
      document.body.append(el);
      await drawn();
      await pastTheThrottle();

      expect(el.readonly).toBe(readonly);
      expect(standing()).toEqual(JUMPED);
    }
  );
});

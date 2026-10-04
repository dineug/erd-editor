import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import Dialog, {
  AUTOFOCUS_ATTRIBUTE,
} from '@/components/primitives/dialog/Dialog';
import * as styles from '@/components/primitives/dialog/Dialog.styles';
import { focusEvent } from '@/utils/internalEvents';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

type Options = {
  autofocus?: boolean;
  controls?: boolean;
};

async function setup({ autofocus = true, controls = true }: Options = {}) {
  const onClose = vi.fn();
  const content = !controls
    ? html`<p>Nothing to press</p>`
    : autofocus
      ? html`<button type="button">First</button
          ><button type="button" class="target" data-autofocus="true">
            Target
          </button>`
      : html`<button type="button">First</button>`;

  mounted = await mountAndFlush(
    html`<${Dialog}
      label=${'Export image'}
      maxWidth=${640}
      .onClose=${onClose}
      .children=${content}
    />`
  );

  const root = mounted.container.firstElementChild as HTMLDivElement;
  const box = mounted.container.querySelector('.dialog') as HTMLDivElement;

  return { root, box, onClose };
}

const keydown = (target: Element, init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

describe('Dialog', () => {
  it('is a labelled modal box over a dim, as wide as it is let grow', async () => {
    const { root, box } = await setup();

    expect(root.classList.contains(String(styles.root))).toBe(true);
    expect(box.classList.contains(String(styles.content))).toBe(true);
    expect(box.getAttribute('role')).toBe('dialog');
    expect(box.getAttribute('aria-modal')).toBe('true');
    expect(box.getAttribute('aria-label')).toBe('Export image');
    expect(box.style.maxWidth).toBe('640px');
    expect(box.textContent).toContain('Target');
  });

  it('focuses the control its content marks when it opens', async () => {
    const { box } = await setup();

    expect(AUTOFOCUS_ATTRIBUTE).toBe('data-autofocus');
    expect(document.activeElement).toBe(box.querySelector('.target'));
  });

  it('takes the focus itself when its content marks nothing', async () => {
    const { box } = await setup({ autofocus: false });

    expect(document.activeElement).toBe(box);
  });

  it('closes on a press on the dim around the box, never on one inside it', async () => {
    const { root, box, onClose } = await setup();

    box
      .querySelector('button')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('spends Escape on closing, so nothing behind it hears the press', async () => {
    const { box, onClose } = await setup();
    const behind = vi.fn();
    mounted!.container.addEventListener('keydown', behind);

    const event = keydown(box.querySelector('.target')!, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    expect(behind).not.toHaveBeenCalled();
  });

  it('leaves an Escape that ends a composition to the input method', async () => {
    const { box, onClose } = await setup();

    const event = keydown(box, { key: 'Escape', isComposing: true });

    expect(onClose).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('keeps Space from the hand tool, unprevented, so a button still takes it', async () => {
    const { box } = await setup();
    const behind = vi.fn();
    mounted!.container.addEventListener('keydown', behind);

    const space = keydown(box, { key: ' ', code: 'Space' });
    const other = keydown(box, { key: 'a', code: 'KeyA' });

    expect(space.defaultPrevented).toBe(false);
    expect(behind).toHaveBeenCalledTimes(1);
    expect(behind.mock.calls[0][0]).toBe(other);
  });

  it('keeps Tab inside the box, from the last control round to the first and back', async () => {
    const { box } = await setup();
    const [first, last] = Array.from(box.querySelectorAll('button'));
    last.focus();

    const forward = keydown(last, { key: 'Tab' });
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    const backward = keydown(first, { key: 'Tab', shiftKey: true });
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('leaves a Tab between two of its controls to the browser', async () => {
    const { box } = await setup();
    const [first, last] = Array.from(box.querySelectorAll('button'));
    first.focus();

    expect(keydown(first, { key: 'Tab' }).defaultPrevented).toBe(false);

    last.focus();
    expect(keydown(last, { key: 'Tab', shiftKey: true }).defaultPrevented).toBe(
      false
    );
  });

  it('sends a Shift+Tab from the box itself to its last control', async () => {
    const { box } = await setup({ autofocus: false });

    const event = keydown(box, { key: 'Tab', shiftKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(box.querySelector('button'));
  });

  it('holds the focus on a box with no control in it, either way round', async () => {
    const { box } = await setup({ controls: false });

    expect(keydown(box, { key: 'Tab' }).defaultPrevented).toBe(true);
    expect(keydown(box, { key: 'Tab', shiftKey: true }).defaultPrevented).toBe(
      true
    );
    expect(document.activeElement).toBe(box);
  });

  it.each(['mousedown', 'touchstart', 'wheel', 'contextmenu'])(
    'keeps a %s from reaching the canvas behind',
    async type => {
      const { box } = await setup();
      const behind = vi.fn();
      mounted!.container.addEventListener(type, behind);

      box.dispatchEvent(new Event(type, { bubbles: true }));

      expect(behind).not.toHaveBeenCalled();
    }
  );

  it('hands the keyboard back to the editor once it is gone', async () => {
    await setup();
    const focused = vi.fn();
    document.body.addEventListener(focusEvent.type, focused);

    mounted!.unmount();
    mounted = null;
    expect(focused).not.toHaveBeenCalled();

    await flush();
    expect(focused).toHaveBeenCalledTimes(1);
    document.body.removeEventListener(focusEvent.type, focused);
  });
});

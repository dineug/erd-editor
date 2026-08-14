import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import ToastContainer from '@/components/toast-container/ToastContainer';
import * as styles from '@/components/toast-container/ToastContainer.styles';
import { openToastAction } from '@/utils/emitter';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
});

const getRoot = (mounted: Mounted) =>
  mounted.container.querySelector(`.${String(styles.root)}`) as HTMLElement;

const getToasts = (mounted: Mounted) =>
  Array.from(
    mounted.container.querySelectorAll<HTMLElement>('.toast-container')
  );

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
};

describe('ToastContainer', () => {
  it('renders an empty pointer-transparent stack', async () => {
    mounted = await mountAndFlush(html`<${ToastContainer} />`);
    const root = getRoot(mounted);

    expect(root).toBeTruthy();
    expect(root.hasAttribute('data-pointer-none')).toBe(true);
    expect(getToasts(mounted)).toHaveLength(0);
  });

  it('appends a toast when the emitter fires openToast', async () => {
    mounted = await mountAndFlush(html`<${ToastContainer} />`);
    const close = createDeferred();

    mounted.app.emitter.emit(
      openToastAction({
        message: html`<span>saved</span>`,
        close: close.promise,
      })
    );
    await flush();

    const toasts = getToasts(mounted);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].textContent).toContain('saved');
    expect(getRoot(mounted).hasAttribute('data-pointer-none')).toBe(false);
  });

  it('stacks multiple toasts in emit order', async () => {
    mounted = await mountAndFlush(html`<${ToastContainer} />`);
    const first = createDeferred();
    const second = createDeferred();

    mounted.app.emitter.emit(
      openToastAction({ message: html`first`, close: first.promise })
    );
    mounted.app.emitter.emit(
      openToastAction({ message: html`second`, close: second.promise })
    );
    await flush();

    const toasts = getToasts(mounted);
    expect(toasts).toHaveLength(2);
    expect(toasts[0].textContent).toContain('first');
    expect(toasts[1].textContent).toContain('second');
  });

  it('removes only the toast whose close promise settles', async () => {
    mounted = await mountAndFlush(html`<${ToastContainer} />`);
    const first = createDeferred();
    const second = createDeferred();

    mounted.app.emitter.emit(
      openToastAction({ message: html`first`, close: first.promise })
    );
    mounted.app.emitter.emit(
      openToastAction({ message: html`second`, close: second.promise })
    );
    await flush();
    expect(getToasts(mounted)).toHaveLength(2);

    first.resolve();
    await flush();

    const toasts = getToasts(mounted);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].textContent).toContain('second');
    expect(getRoot(mounted).hasAttribute('data-pointer-none')).toBe(false);

    second.resolve();
    await flush();

    expect(getToasts(mounted)).toHaveLength(0);
    expect(getRoot(mounted).hasAttribute('data-pointer-none')).toBe(true);
  });

  it('auto closes a toast after the default 5s when no close promise is given', async () => {
    vi.useFakeTimers();
    mounted = await mountAndFlush(html`<${ToastContainer} />`);

    mounted.app.emitter.emit(openToastAction({ message: html`auto` }));
    await flush();
    expect(getToasts(mounted)).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(4999);
    await flush();
    expect(getToasts(mounted)).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(getToasts(mounted)).toHaveLength(0);
  });

  it('marks a toast as animation-one once its entry animation ended', async () => {
    mounted = await mountAndFlush(html`<${ToastContainer} />`);
    const first = createDeferred();
    const second = createDeferred();

    mounted.app.emitter.emit(
      openToastAction({ message: html`first`, close: first.promise })
    );
    await flush();

    const [firstToast] = getToasts(mounted);
    expect(firstToast.hasAttribute('data-animation-one')).toBe(false);

    firstToast.dispatchEvent(new Event('animationend'));
    await flush();

    // re-render is driven by the toast list, so add one to repaint the stack
    mounted.app.emitter.emit(
      openToastAction({ message: html`second`, close: second.promise })
    );
    await flush();

    const toasts = getToasts(mounted);
    expect(toasts).toHaveLength(2);
    expect(toasts[0].hasAttribute('data-animation-one')).toBe(true);
    expect(toasts[1].hasAttribute('data-animation-one')).toBe(false);
  });

  it('ignores a repeated close signal for a toast that is already gone', async () => {
    mounted = await mountAndFlush(html`<${ToastContainer} />`);
    const closeCallbacks: Array<() => void> = [];
    // the component only ever calls `.finally` on the close promise, so a
    // thenable double lets us replay the close signal twice
    const close = {
      finally(callback: () => void) {
        closeCallbacks.push(callback);
        return close;
      },
    };

    mounted.app.emitter.emit(
      openToastAction({ message: html`once`, close: close as any })
    );
    await flush();
    expect(getToasts(mounted)).toHaveLength(1);
    expect(closeCallbacks).toHaveLength(1);

    closeCallbacks[0]();
    await flush();
    expect(getToasts(mounted)).toHaveLength(0);

    expect(() => closeCallbacks[0]()).not.toThrow();
    await flush();
    expect(getToasts(mounted)).toHaveLength(0);
  });

  it('stops listening to the emitter after unmount', async () => {
    mounted = await mountAndFlush(html`<${ToastContainer} />`);
    const { app, container } = mounted;
    const close = createDeferred();

    mounted.unmount();
    mounted = null;
    await flush();

    app.emitter.emit(
      openToastAction({ message: html`ghost`, close: close.promise })
    );
    await flush();

    expect(container.querySelectorAll('.toast-container')).toHaveLength(0);
    expect(document.body.contains(container)).toBe(false);
  });
});

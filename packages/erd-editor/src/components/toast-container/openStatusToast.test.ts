import { html } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { iconNameOf } from '@/__test-utils__/icon';
import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import * as styles from '@/components/primitives/toast/Toast.styles';
import {
  openStatusToast,
  reportCopy,
} from '@/components/toast-container/openStatusToast';
import { Emitter, openToastAction } from '@/utils/emitter';

type ToastPayload = ReturnType<typeof openToastAction>['payload'];

let emitter: Emitter;
let toasts: ToastPayload[];
let off: () => void;
let mounted: Mounted | null = null;

beforeEach(() => {
  emitter = new Emitter();
  toasts = [];
  off = emitter.on({ openToast: action => toasts.push(action.payload) });
});

afterEach(() => {
  off();
  emitter.clear();
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
});

const query = (token: unknown) =>
  mounted!.container.querySelector(
    `.${CSS.escape(String(token))}`
  ) as HTMLElement | null;

/** Mounts the toast a payload carries, as the container would. */
const show = async (payload: ToastPayload) => {
  mounted = await mountAndFlush(html`${payload.message}`);
};

describe('openStatusToast', () => {
  it('opens one toast under its key, the line as its title and the tone as its mark', async () => {
    openStatusToast(emitter, {
      key: 'report',
      tone: 'error',
      title: html`Failed`,
      description: html`Why`,
    });

    expect(toasts).toHaveLength(1);
    expect(toasts[0].key).toBe('report');
    expect(toasts[0].close).toBeUndefined();

    await show(toasts[0]);

    expect(query(styles.title)?.textContent?.trim()).toBe('Failed');
    expect(query(styles.description)?.textContent?.trim()).toBe('Why');
    expect(query(styles.indicator)?.getAttribute('data-tone')).toBe('error');
    expect(iconNameOf(query(styles.indicator))).toBe('triangle-alert');
  });

  it('passes the close it is given on to the container', () => {
    const close = Promise.resolve();

    openStatusToast(emitter, { key: 'report', title: html`Done`, close });

    expect(toasts[0].close).toBe(close);
  });

  it('draws no mark without a tone', async () => {
    openStatusToast(emitter, { key: 'report', title: html`Nothing to do` });
    await show(toasts[0]);

    expect(query(styles.indicator)).toBeNull();
    expect(query(styles.description)).toBeNull();
  });
});

describe('reportCopy', () => {
  it('reports a copy that worked as a short success under the copy key', async () => {
    vi.useFakeTimers();
    await reportCopy(emitter, Promise.resolve());

    expect(toasts).toHaveLength(1);
    expect(toasts[0].key).toBe('copy');

    const closed = vi.fn();
    toasts[0].close?.then(closed);
    await vi.advanceTimersByTimeAsync(1999);
    expect(closed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(closed).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
    await show(toasts[0]);
    expect(query(styles.title)?.textContent?.trim()).toBe('Copied!');
    expect(iconNameOf(query(styles.indicator))).toBe('check');
  });

  it('reports a refused copy as an error under the same key, left up as long as any toast', async () => {
    await reportCopy(emitter, Promise.reject(new Error('refused')));

    expect(toasts).toHaveLength(1);
    expect(toasts[0].key).toBe('copy');
    expect(toasts[0].close).toBeUndefined();

    await show(toasts[0]);
    expect(query(styles.title)?.textContent?.trim()).toBe(
      "Couldn't copy to the clipboard"
    );
    expect(query(styles.indicator)?.getAttribute('data-tone')).toBe('error');
  });
});

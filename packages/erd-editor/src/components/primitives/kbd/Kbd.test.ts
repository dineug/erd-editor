import { FC, html, observable } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import Kbd from '@/components/primitives/kbd/Kbd';
import * as styles from '@/components/primitives/kbd/Kbd.styles';

const device = vi.hoisted(() => ({ apple: false }));

vi.mock('@/utils/device-detect', () => ({
  hasAppleDevice: () => device.apple,
}));

let mounted: Mounted | null = null;

beforeEach(() => {
  device.apple = false;
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const root = () => mounted!.container.querySelector('.kbd') as HTMLElement;
const keyTexts = () =>
  [...root().children].map(el => el.textContent?.trim() ?? '');

describe('Kbd', () => {
  it('renders the root wrapper even without a shortcut', async () => {
    mounted = await mountAndFlush(html`<${Kbd} />`);

    const el = root();
    expect(el).toBeTruthy();
    expect([...el.classList]).toContain(String(styles.root));
    expect(el.children.length).toBe(0);
  });

  it('renders nothing for an empty shortcut string', async () => {
    mounted = await mountAndFlush(html`<${Kbd} shortcut=${''} />`);

    expect(root().children.length).toBe(0);
  });

  it('joins modifiers and the key with a plus separator', async () => {
    mounted = await mountAndFlush(
      html`<${Kbd} shortcut=${'Shift+Alt+KeyA'} />`
    );

    expect(keyTexts()).toEqual(['Shift + Alt + A']);
  });

  it('renders one chip per chord of a sequence', async () => {
    mounted = await mountAndFlush(html`<${Kbd} shortcut=${'KeyG KeyD'} />`);

    expect(root().children.length).toBe(2);
    expect(keyTexts()).toEqual(['G', 'D']);
  });

  it('uses the normal chip class by default', async () => {
    mounted = await mountAndFlush(html`<${Kbd} shortcut=${'KeyA'} />`);

    const chip = root().children[0];
    expect([...chip.classList]).toContain(String(styles.kbd));
    expect([...chip.classList]).not.toContain(String(styles.mini));
  });

  it('uses the mini chip class when mini is set', async () => {
    mounted = await mountAndFlush(
      html`<${Kbd} shortcut=${'KeyA'} .mini=${true} />`
    );
    await flush();

    const chip = root().children[0];
    expect([...chip.classList]).toContain(String(styles.mini));
    expect([...chip.classList]).not.toContain(String(styles.kbd));
  });

  it('renders windows modifier labels on non-apple devices', async () => {
    mounted = await mountAndFlush(html`<${Kbd} shortcut=${'$mod+KeyK'} />`);

    expect(keyTexts()).toEqual(['Ctrl + K']);
  });

  it('renders mac symbols on apple devices', async () => {
    device.apple = true;
    mounted = await mountAndFlush(html`<${Kbd} shortcut=${'$mod+KeyK'} />`);

    expect(keyTexts()).toEqual(['⌘ + K']);
  });

  it('maps special codes to their symbols', async () => {
    mounted = await mountAndFlush(
      html`<${Kbd} shortcut=${'Backspace Escape Digit1'} />`
    );

    expect(keyTexts()).toEqual(['⌫', 'ESC', '1']);
  });

  it('re-renders when the shortcut prop changes', async () => {
    const state = observable({ shortcut: 'KeyA' });
    const Wrapper: FC = () => () => html`<${Kbd} shortcut=${state.shortcut} />`;

    mounted = await mountAndFlush(html`<${Wrapper} />`);
    expect(keyTexts()).toEqual(['A']);

    state.shortcut = 'Alt+KeyB';
    await flush();

    expect(keyTexts()).toEqual(['Alt + B']);
  });
});

// The list laid out in a real Chromium, in its stylesheets in a shadow root as
// the element has one: where the chevron stands in either direction, the room
// a long value leaves it, where a press lands and the colours it takes.

import { addCSSHost, html, render } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { cdp, userEvent } from 'vite-plus/test/browser/context';

import { flush } from '@/__test-utils__';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import Select, {
  SELECT_CHEVRON_SIZE,
} from '@/components/primitives/select/Select';

/** A sentinel per token, so a colour reads back as the token that painted it. */
const ACTIVE = 'rgb(4, 5, 6)';
const PLACEHOLDER = 'rgb(7, 8, 9)';
const TOKENS = [
  `--active: ${ACTIVE}`,
  `--placeholder: ${PLACEHOLDER}`,
  '--input-active: rgb(10, 11, 12)',
  '--context-menu-background: rgb(24, 25, 27)',
  '--context-menu-border: rgb(54, 58, 63)',
  'width: 200px',
].join('; ');

/** Lucide draws the chevron from 6 to 18 of 24 with a 2 wide stroke, so its ink spans 5 to 19. */
const INK_START = 5 / 24;
const INK_END = 19 / 24;

const LONG = 'customer_order_item_shipping_addresses_by_region';

/** The one CDP command the spec sends, which the provider's session types only under its own config. */
type MediaSession = {
  send: (method: string, params: Record<string, unknown>) => Promise<unknown>;
};

const session = () => cdp() as unknown as MediaSession;

const teardowns: Array<() => void | Promise<unknown>> = [];

afterEach(async () => {
  for (const teardown of teardowns.splice(0)) await teardown();
});

type Options = {
  dir?: 'ltr' | 'rtl';
  dimmed?: boolean;
  disabled?: boolean;
  value?: string;
};

async function setup({
  dir = 'ltr',
  dimmed = false,
  disabled = false,
  value = 'MySQL',
}: Options = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);
  const globals = document.createElement('div');
  const container = document.createElement('div');
  container.setAttribute('style', TOKENS);
  container.dir = dir;
  shadow.append(globals, container);

  render(globals, html`<${GlobalStyles} />`);
  render(
    container,
    html`
      <button type="button">before</button>
      <${Select}
        dimmed=${dimmed}
        .children=${html`
          <select ?disabled=${disabled}>
            <option>${value}</option>
          </select>
        `}
      />
    `
  );
  teardowns.push(() => {
    render(container, null);
    render(globals, null);
    host.remove();
  });
  await flush();

  const select = shadow.querySelector('select') as HTMLSelectElement;
  const svg = select.parentElement!.querySelector('svg') as SVGSVGElement;
  return { shadow, select, svg };
}

/**
 * The value's inset from its border and the chevron's ink from the other one,
 * each from the inner edge of the border, and where the value's room ends
 * beside the chevron's nearer ink.
 */
function insets(select: HTMLSelectElement, svg: SVGSVGElement) {
  const style = getComputedStyle(select);
  const box = select.getBoundingClientRect();
  const icon = svg.getBoundingClientRect();
  const left = box.left + parseFloat(style.borderLeftWidth);
  const right = box.right - parseFloat(style.borderRightWidth);
  const inkLeft = icon.left + icon.width * INK_START;
  const inkRight = icon.left + icon.width * INK_END;

  return style.direction === 'rtl'
    ? {
        text: parseFloat(style.paddingRight),
        chevron: inkLeft - left,
        valueEnd: left + parseFloat(style.paddingLeft),
        inkNear: inkRight,
      }
    : {
        text: parseFloat(style.paddingLeft),
        chevron: right - inkRight,
        valueEnd: right - parseFloat(style.paddingRight),
        inkNear: inkLeft,
      };
}

describe('Select in a real browser', () => {
  it.each(['ltr', 'rtl'] as const)(
    '%s: stands the chevron as far in from the end border as the value from the start one',
    async dir => {
      const { select, svg } = await setup({ dir });
      const { text, chevron } = insets(select, svg);

      expect(text).toBe(8);
      // the ink of a value's first letter stands a side bearing past its
      // padding, which the chevron's ink, under a pixel further in, matches
      expect(chevron).toBeGreaterThanOrEqual(text);
      expect(chevron).toBeLessThan(text + 1);
    }
  );

  it.each(['ltr', 'rtl'] as const)(
    '%s: sets the chevron at the inline end, centred on the list',
    async dir => {
      const { select, svg } = await setup({ dir });
      const box = select.getBoundingClientRect();
      const icon = svg.getBoundingClientRect();

      expect(icon.width).toBe(SELECT_CHEVRON_SIZE);
      if (dir === 'rtl') {
        expect(icon.left).toBeLessThan(box.left + box.width / 2);
      } else {
        expect(icon.right).toBeGreaterThan(box.left + box.width / 2);
      }
      expect(icon.top + icon.height / 2).toBe(box.top + box.height / 2);
    }
  );

  it.each(['ltr', 'rtl'] as const)(
    '%s: ends a long value short of the chevron, with as much room as its inset',
    async dir => {
      const { select, svg } = await setup({ dir, value: LONG });
      const { text, valueEnd, inkNear } = insets(select, svg);

      expect(getComputedStyle(select).textOverflow).toBe('ellipsis');
      expect(Math.abs(inkNear - valueEnd)).toBeGreaterThanOrEqual(text);
      if (dir === 'rtl') expect(valueEnd).toBeGreaterThan(inkNear);
      else expect(valueEnd).toBeLessThan(inkNear);
    }
  );

  it('lets a press on the chevron through to the list', async () => {
    const { shadow, select, svg } = await setup();
    const icon = svg.getBoundingClientRect();

    expect(getComputedStyle(svg).pointerEvents).toBe('none');
    expect(
      shadow.elementFromPoint(
        icon.left + icon.width / 2,
        icon.top + icon.height / 2
      )
    ).toBe(select);
  });

  it('paints the chevron in the value colour, dimmed with it', async () => {
    const active = await setup();
    expect(getComputedStyle(active.select).color).toBe(ACTIVE);
    expect(getComputedStyle(active.svg).color).toBe(ACTIVE);

    const dimmed = await setup({ dimmed: true });
    expect(getComputedStyle(dimmed.select).color).toBe(PLACEHOLDER);
    expect(getComputedStyle(dimmed.svg).color).toBe(PLACEHOLDER);

    const disabled = await setup({ disabled: true });
    expect(getComputedStyle(disabled.select).color).toBe(PLACEHOLDER);
    expect(getComputedStyle(disabled.svg).color).toBe(PLACEHOLDER);
  });

  it('rings the list the keyboard reaches', async () => {
    const { shadow, select } = await setup();
    (shadow.querySelector('button') as HTMLButtonElement).focus();

    await userEvent.tab();

    expect(shadow.activeElement).toBe(select);
    const style = getComputedStyle(select);
    expect(style.outlineStyle).toBe('solid');
    expect(style.outlineWidth).toBe('2px');
    expect(style.outlineOffset).toBe('1px');
  });

  it('still draws its arrow when the system forces its own colours', async () => {
    await session().send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    });
    teardowns.push(() =>
      session().send('Emulation.setEmulatedMedia', { features: [] })
    );
    expect(matchMedia('(forced-colors: active)').matches).toBe(true);

    const { select, svg } = await setup();
    const paint = getComputedStyle(svg).color;

    expect(paint).toBe(getComputedStyle(select).color);
    expect(paint).not.toBe(getComputedStyle(select).backgroundColor);
    expect(svg.getBoundingClientRect().width).toBe(SELECT_CHEVRON_SIZE);
  });
});

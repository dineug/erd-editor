import { css, html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { iconNameOf } from '@/__test-utils__/icon';
import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import Select, {
  SELECT_CHEVRON_SIZE,
  SelectProps,
} from '@/components/primitives/select/Select';
import * as styles from '@/components/primitives/select/Select.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const width = css`
  width: 132px;
`;

async function setup(props: Partial<SelectProps> = {}) {
  const onChange = vi.fn();
  mounted = await mountAndFlush(
    html`<${Select}
      class=${props.class}
      dimmed=${props.dimmed}
      .children=${html`
        <select id="picked" aria-describedby="note" @change=${onChange}>
          <option .value=${'1'}>One</option>
          <option .value=${'2'} .selected=${true}>Two</option>
        </select>
      `}
    />`
  );

  const select = mounted.container.querySelector('select') as HTMLSelectElement;
  const box = select.parentElement as HTMLElement;
  const mark = box.querySelector(`.${String(styles.chevron)}`) as HTMLElement;

  return { box, select, mark, onChange };
}

describe('Select', () => {
  it('holds the select it is given, as written, in its box', async () => {
    const { box, select } = await setup();

    expect(box.classList.contains(String(styles.root))).toBe(true);
    expect(select.id).toBe('picked');
    expect(select.getAttribute('aria-describedby')).toBe('note');
    expect(select.value).toBe('2');
  });

  it('draws the chevron after the list, hidden from assistive technology', async () => {
    const { select, mark } = await setup();

    expect(select.nextElementSibling).toBe(mark);
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    expect(iconNameOf(mark)).toBe('chevron-down');
    expect(mark.querySelector('svg')?.style.width).toBe(
      `${SELECT_CHEVRON_SIZE}px`
    );
  });

  it('takes the width and place its caller gives the box', async () => {
    const { box } = await setup({ class: width });

    expect(box.classList.contains(String(width))).toBe(true);
    expect(box.classList.contains(String(styles.root))).toBe(true);
  });

  it('dims the box only when asked', async () => {
    expect((await setup()).box.hasAttribute('data-dimmed')).toBe(false);
    mounted?.unmount();

    expect(
      (await setup({ dimmed: false })).box.hasAttribute('data-dimmed')
    ).toBe(false);
    mounted?.unmount();

    expect(
      (await setup({ dimmed: true })).box.hasAttribute('data-dimmed')
    ).toBe(true);
  });

  it("hands a pick to the select's own change handler", async () => {
    const { select, onChange } = await setup();

    select.value = '1';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0].target as HTMLSelectElement).value).toBe(
      '1'
    );
  });
});

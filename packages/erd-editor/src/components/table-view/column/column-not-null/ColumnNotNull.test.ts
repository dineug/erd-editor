import { FC, html, observable } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import ColumnNotNull from '@/components/table-view/column/column-not-null/ColumnNotNull';
import * as styles from '@/components/table-view/column/column-not-null/ColumnNotNull.styles';
import { COLUMN_NOT_NULL_WIDTH } from '@/constants/layout';
import { ColumnOption } from '@/constants/schema';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function mountNotNull(options: number, focus = false) {
  mounted = await mountAndFlush(
    html`<${ColumnNotNull} options=${options} focus=${focus} />`
  );
  return mounted.container.querySelector(
    `.${styles.notNull}`
  ) as HTMLDivElement;
}

describe('ColumnNotNull', () => {
  it('renders NULL when the notNull option bit is unset', async () => {
    const el = await mountNotNull(0);

    expect(el).toBeTruthy();
    expect(el.textContent?.trim()).toBe('NULL');
  });

  it('renders N-N when the notNull option bit is set', async () => {
    const el = await mountNotNull(ColumnOption.notNull);

    expect(el.textContent?.trim()).toBe('N-N');
  });

  it('reads only the notNull bit out of a combined option mask', async () => {
    const el = await mountNotNull(
      ColumnOption.unique | ColumnOption.autoIncrement
    );

    expect(el.textContent?.trim()).toBe('NULL');

    mounted?.unmount();
    mounted = null;

    const withNotNull = await mountNotNull(
      ColumnOption.unique | ColumnOption.notNull | ColumnOption.primaryKey
    );

    expect(withNotNull.textContent?.trim()).toBe('N-N');
  });

  it('locks the cell to COLUMN_NOT_NULL_WIDTH in both width and min-width', async () => {
    const el = await mountNotNull(0);

    expect(el.style.width).toBe(`${COLUMN_NOT_NULL_WIDTH}px`);
    expect(el.style.minWidth).toBe(`${COLUMN_NOT_NULL_WIDTH}px`);
  });

  it('always exposes the "Not Null" tooltip', async () => {
    const el = await mountNotNull(0);

    expect(el.getAttribute('title')).toBe('Not Null');
  });

  it('omits the focus class and border attribute when not focused', async () => {
    const el = await mountNotNull(0, false);

    expect(el.classList.contains('focus')).toBe(false);
    expect(el.hasAttribute('data-focus-border-bottom')).toBe(false);
  });

  it('adds the focus class and border attribute when focused', async () => {
    const el = await mountNotNull(ColumnOption.notNull, true);

    expect(el.classList.contains('focus')).toBe(true);
    expect(el.hasAttribute('data-focus-border-bottom')).toBe(true);
  });

  it('flips the label and focus state reactively', async () => {
    const state = observable({ options: 0, focus: false });
    const Wrapper: FC<any> = () => () =>
      html`<${ColumnNotNull} options=${state.options} focus=${state.focus} />`;

    mounted = await mountAndFlush(html`<${Wrapper} />`);
    const el = mounted.container.querySelector(
      `.${styles.notNull}`
    ) as HTMLDivElement;

    expect(el.textContent?.trim()).toBe('NULL');

    state.options = ColumnOption.notNull;
    state.focus = true;
    await flush();

    expect(el.textContent?.trim()).toBe('N-N');
    expect(el.classList.contains('focus')).toBe(true);
  });
});

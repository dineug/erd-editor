import { FC, html, observable } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import TablePropertiesTabs, {
  Tab,
} from '@/components/erd/table-properties/table-properties-tabs/TablePropertiesTabs';
import * as styles from '@/components/erd/table-properties/table-properties-tabs/TablePropertiesTabs.styles';

const tabsOf = (mounted: Mounted) =>
  Array.from(
    mounted.container.querySelectorAll(`.${String(styles.tab)}`)
  ) as HTMLElement[];

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe('TablePropertiesTabs', () => {
  it('exposes the three tab names as a frozen-ish const map', () => {
    expect(Tab.Indexes).toBe('Indexes');
    expect(Tab.SchemaSQL).toBe('Schema SQL');
    expect(Tab.GeneratorCode).toBe('Code Generator');
  });

  it('renders one tab per entry of the Tab map, in declaration order', async () => {
    mounted = await mountAndFlush(
      html`<${TablePropertiesTabs} value=${Tab.Indexes} />`
    );

    const tabs = tabsOf(mounted);
    expect(tabs).toHaveLength(3);
    expect(tabs.map(el => el.textContent?.trim())).toEqual([
      'Indexes',
      'Schema SQL',
      'Code Generator',
    ]);
  });

  it('wraps the tabs in the strip container', async () => {
    mounted = await mountAndFlush(
      html`<${TablePropertiesTabs} value=${Tab.Indexes} />`
    );

    const strip = mounted.container.querySelector(
      `.${String(styles.tabs)}`
    ) as HTMLElement;

    expect(strip).toBeTruthy();
    expect(strip.children).toHaveLength(3);
  });

  it('marks only the tab matching `value` as selected', async () => {
    mounted = await mountAndFlush(
      html`<${TablePropertiesTabs} value=${Tab.SchemaSQL} />`
    );

    expect(
      tabsOf(mounted).map(el => el.classList.contains('selected'))
    ).toEqual([false, true, false]);
  });

  it('moves the selected class when `value` changes', async () => {
    const state = observable({ value: Tab.Indexes as Tab });
    const Host: FC<{}> = () => () =>
      html`<${TablePropertiesTabs} value=${state.value} />`;

    mounted = await mountAndFlush(html`<${Host} />`);
    expect(tabsOf(mounted)[0].classList.contains('selected')).toBe(true);

    state.value = Tab.GeneratorCode;
    await flush();

    expect(
      tabsOf(mounted).map(el => el.classList.contains('selected'))
    ).toEqual([false, false, true]);
  });

  it('reports the clicked tab through onChange', async () => {
    const onChange = vi.fn();
    mounted = await mountAndFlush(
      html`<${TablePropertiesTabs}
        value=${Tab.Indexes}
        .onChange=${onChange}
      />`
    );

    click(tabsOf(mounted)[1]);
    await flush();
    click(tabsOf(mounted)[2]);
    await flush();

    expect(onChange).toHaveBeenNthCalledWith(1, Tab.SchemaSQL);
    expect(onChange).toHaveBeenNthCalledWith(2, Tab.GeneratorCode);
  });

  it('still reports a click on the already selected tab', async () => {
    const onChange = vi.fn();
    mounted = await mountAndFlush(
      html`<${TablePropertiesTabs}
        value=${Tab.Indexes}
        .onChange=${onChange}
      />`
    );

    click(tabsOf(mounted)[0]);
    await flush();

    expect(onChange).toHaveBeenCalledExactlyOnceWith(Tab.Indexes);
  });
});

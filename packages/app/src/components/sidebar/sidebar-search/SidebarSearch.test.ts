import { act, createElement, useRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { pressKey, render } from '@/__test-utils__/render';
import SidebarSearch from '@/components/sidebar/sidebar-search/SidebarSearch';

// The field above a list of two items, holding its query the way
// useSidebarList does.
function Search({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const listRef = useRef<HTMLDivElement>(null);

  return createElement(
    'div',
    null,
    createElement(SidebarSearch, {
      label: 'Search items',
      value: query,
      onChange: setQuery,
      listRef,
    }),
    createElement(
      'div',
      { ref: listRef, 'data-schema-list': '' },
      ['Orders', 'Users'].map(name =>
        createElement(
          'button',
          { key: name, type: 'button', tabIndex: -1, 'data-schema-item': '' },
          name
        )
      )
    )
  );
}

let view: ReturnType<typeof render> | undefined;

function mount(initialQuery = '') {
  view = render(createElement(Search, { initialQuery }));
  const field = document.querySelector<HTMLInputElement>(
    'input[aria-label="Search items"]'
  );
  if (!field) throw new Error('no search field');
  act(() => field.focus());
  return field;
}

afterEach(() => {
  view?.unmount();
  view = undefined;
});

describe('SidebarSearch', () => {
  it('clears the query and lets go of focus on Escape', () => {
    const field = mount('ord');
    expect(field.value).toBe('ord');

    pressKey(field, 'Escape');
    expect(field.value).toBe('');
    expect(document.activeElement).not.toBe(field);
  });

  it('moves focus to the first item of the list on ArrowDown', () => {
    const field = mount();

    pressKey(field, 'ArrowDown');
    expect(document.activeElement?.textContent).toBe('Orders');
  });
});

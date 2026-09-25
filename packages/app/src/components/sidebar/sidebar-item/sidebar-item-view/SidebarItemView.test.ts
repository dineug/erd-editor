import { act, createElement, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flushTimers, pressKey, render } from '@/__test-utils__/render';
import SidebarItemView from '@/components/sidebar/sidebar-item/sidebar-item-view/SidebarItemView';

const NAMES = ['Orders', 'Users', 'Payments'];

type RemoveProps =
  | { onRemove: () => void; removeLabel: string }
  | { onRemove?: undefined; removeLabel?: undefined };

interface ListProps {
  removable?: boolean;
  renameDisabled?: boolean;
  onRename?: (name: string) => void;
}

// A list of three rows the way an adapter puts them together, where removing
// a row drops it.
function List({ removable = true, renameDisabled, onRename }: ListProps) {
  const [names, setNames] = useState(NAMES);

  const removeProps = (name: string): RemoveProps =>
    removable
      ? {
          removeLabel: 'Remove',
          onRemove: () =>
            setNames(prev => prev.filter(value => value !== name)),
        }
      : {};

  return createElement(
    'div',
    { 'data-schema-list': '' },
    names.map((name, index) =>
      createElement(SidebarItemView, {
        key: name,
        name,
        selected: false,
        tabStop: index === 0,
        inputLabel: 'Item name',
        inputPlaceholder: 'item name',
        renameDisabled,
        onFocus: () => {},
        onSelect: () => {},
        onRename: onRename ?? (() => {}),
        ...removeProps(name),
      })
    )
  );
}

let view: ReturnType<typeof render> | undefined;

function mount(props: ListProps = {}) {
  view = render(createElement(List, props));
}

afterEach(() => {
  view?.unmount();
  view = undefined;
});

function row(name: string) {
  const found = Array.from(
    document.querySelectorAll<HTMLElement>('[data-schema-item]')
  ).find(item => item.textContent === name);
  if (!found) throw new Error(`no row named ${name}`);
  return found;
}

function rowNames() {
  return Array.from(document.querySelectorAll('[data-schema-item]')).map(
    item => item.textContent
  );
}

function nameField() {
  return document.querySelector<HTMLInputElement>(
    'input[aria-label="Item name"]'
  );
}

function focus(element: HTMLElement) {
  act(() => element.focus());
}

function openMenu(name: string) {
  const trigger = document.querySelector<HTMLElement>(
    `[aria-label="Actions for ${name}"]`
  );
  if (!trigger) throw new Error(`no menu trigger for ${name}`);
  pressKey(trigger, 'Enter');
}

function menuItem(label: string) {
  const found = Array.from(
    document.querySelectorAll<HTMLElement>('[role="menuitem"]')
  ).find(item => item.textContent === label);
  if (!found) throw new Error(`no menu item ${label}`);
  return found;
}

function type(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set;
  act(() => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('SidebarItemView', () => {
  it('moves focus with the arrows, Home and End, across the list', () => {
    mount();

    focus(row('Orders'));
    pressKey(row('Orders'), 'ArrowDown');
    expect(document.activeElement).toBe(row('Users'));

    pressKey(row('Users'), 'End');
    expect(document.activeElement).toBe(row('Payments'));

    pressKey(row('Payments'), 'ArrowDown');
    expect(document.activeElement).toBe(row('Payments'));

    pressKey(row('Payments'), 'Home');
    expect(document.activeElement).toBe(row('Orders'));

    pressKey(row('Orders'), 'ArrowUp');
    expect(document.activeElement).toBe(row('Orders'));
  });

  it('renames on F2 and hands focus back to the row', () => {
    const onRename = vi.fn();
    mount({ onRename });

    focus(row('Users'));
    pressKey(row('Users'), 'F2');
    const input = nameField();
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);

    type(input!, '  Members  ');
    pressKey(input!, 'Enter');
    expect(onRename).toHaveBeenCalledExactlyOnceWith('Members');
    expect(nameField()).toBeNull();
    expect(document.activeElement).toBe(row('Users'));
  });

  it('keeps the name when the rename is cancelled or left unchanged', () => {
    const onRename = vi.fn();
    mount({ onRename });

    pressKey(row('Users'), 'F2');
    type(nameField()!, 'Members');
    pressKey(nameField()!, 'Escape');
    expect(nameField()).toBeNull();

    pressKey(row('Users'), 'F2');
    type(nameField()!, '   ');
    pressKey(nameField()!, 'Enter');
    expect(onRename).not.toHaveBeenCalled();
  });

  it('focuses the row taking the place of one Delete or Backspace removes', () => {
    mount();

    focus(row('Users'));
    pressKey(row('Users'), 'Delete');
    expect(rowNames()).toEqual(['Orders', 'Payments']);
    expect(document.activeElement).toBe(row('Payments'));

    pressKey(row('Payments'), 'Backspace');
    expect(rowNames()).toEqual(['Orders']);
    expect(document.activeElement).toBe(row('Orders'));
  });

  it('focuses the next row once the menu that removed one has closed', async () => {
    mount();

    openMenu('Users');
    act(() => menuItem('Remove').click());
    await flushTimers();

    expect(rowNames()).toEqual(['Orders', 'Payments']);
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(row('Payments'));
  });

  it('has no remove path without onRemove', () => {
    mount({ removable: false });

    focus(row('Users'));
    pressKey(row('Users'), 'Delete');
    pressKey(row('Users'), 'Backspace');
    expect(rowNames()).toEqual(NAMES);

    openMenu('Users');
    const labels = Array.from(
      document.querySelectorAll('[role="menuitem"]')
    ).map(item => item.textContent);
    expect(labels).toEqual(['Rename']);
    expect(document.querySelector('[role="separator"]')).toBeNull();
  });

  it('leaves F2, a double click and Rename inert when rename is disabled', async () => {
    mount({ renameDisabled: true });

    pressKey(row('Users'), 'F2');
    act(() => {
      row('Users').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(nameField()).toBeNull();

    openMenu('Users');
    const rename = menuItem('Rename');
    expect(rename.getAttribute('aria-disabled')).toBe('true');

    // Radix calls a disabled item's onClick anyway, and a field that mounted
    // would take focus even if the open menu took it back at once.
    const focused: Array<string | null> = [];
    const record = (event: FocusEvent) =>
      focused.push((event.target as Element).getAttribute('aria-label'));
    document.addEventListener('focusin', record);
    act(() => rename.click());
    await flushTimers();
    document.removeEventListener('focusin', record);

    expect(focused).not.toContain('Item name');
    expect(nameField()).toBeNull();
  });

  it('starts a rename on a double click', () => {
    mount();

    act(() => {
      row('Users').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(nameField()?.value).toBe('Users');
  });
});

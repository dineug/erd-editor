import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestAppContext } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { createImportMenus } from '@/components/erd/erd-context-menu/menus/importMenus';
import { setImportFileCallback } from '@/utils/file/importFile';

let app: AppContext;
let requests: Array<{ type: string; op: string; accept: string }>;

beforeEach(() => {
  app = createTestAppContext();
  requests = [];
  setImportFileCallback(options => {
    requests.push({ ...options });
  });
});

afterEach(() => {
  setImportFileCallback(null);
});

describe('importMenus', () => {
  it('exposes a json and a Schema SQL entry with their icons', () => {
    const result = createImportMenus(app, () => {});

    expect(result.map(menu => menu.name)).toEqual(['json', 'Schema SQL']);
    expect(result.map(menu => menu.icon)).toEqual([
      { prefix: 'mdi', name: 'code-json' },
      { prefix: 'mdi', name: 'database-import' },
    ]);
  });

  it('requests a json import and closes the menu', () => {
    const onClose = vi.fn();

    createImportMenus(app, onClose)[0].onClick();

    expect(requests).toEqual([{ type: 'json', op: 'set', accept: '.json' }]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('requests a sql import and closes the menu', () => {
    const onClose = vi.fn();

    createImportMenus(app, onClose)[1].onClick();

    expect(requests).toEqual([{ type: 'sql', op: 'set', accept: '.sql' }]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to a file input when no import callback is registered', () => {
    setImportFileCallback(null);
    const onClose = vi.fn();
    const click = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => {});

    createImportMenus(app, onClose)[0].onClick();

    expect(click).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });
});

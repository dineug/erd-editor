import '@/erd-viewer';

import { parser, toDocumentJson } from '@dineug/erd-editor-schema';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from 'vite-plus/test';

import type { ErdViewerElement } from '@/components/erd-viewer/ErdViewer';

const shadowRoots = new WeakMap<Element, ShadowRoot>();
const originalAttachShadow = Element.prototype.attachShadow;

beforeAll(() => {
  Element.prototype.attachShadow = function attachShadow(
    this: Element,
    init: ShadowRootInit
  ) {
    const shadow = originalAttachShadow.call(this, init);
    shadowRoots.set(this, shadow);
    return shadow;
  };
});

afterAll(() => {
  Element.prototype.attachShadow = originalAttachShadow;
});

afterEach(() => {
  document.body.replaceChildren();
});

/** A file holding one table, as a host would hand it over. */
const USERS_FILE = JSON.stringify({
  version: '3.0.0',
  doc: { tableIds: ['users'] },
  collections: { tableEntities: { users: { id: 'users', name: 'users' } } },
});

function mountViewer(attributes: Record<string, string> = {}) {
  const viewer = document.createElement('erd-viewer');

  for (const [name, value] of Object.entries(attributes)) {
    viewer.setAttribute(name, value);
  }
  document.body.append(viewer);

  return viewer;
}

function shadowOf(viewer: ErdViewerElement): ShadowRoot {
  const shadow = shadowRoots.get(viewer);
  if (!shadow) throw new Error('the viewer attached no shadow root');
  return shadow;
}

describe('<erd-viewer> attributes', () => {
  it('shows the minimap and the controls with neither attribute written', () => {
    const viewer = mountViewer();

    expect(viewer.minimap).toBe(true);
    expect(viewer.controls).toBe(true);
  });

  it.each(['minimap', 'controls'] as const)(
    'turns %s off only for the attribute value "false"',
    name => {
      const viewer = mountViewer({ [name]: 'false' });

      expect(viewer[name]).toBe(false);

      viewer.setAttribute(name, '');
      expect(viewer[name]).toBe(true);

      viewer.setAttribute(name, 'false');
      viewer.setAttribute(name, 'true');
      expect(viewer[name]).toBe(true);

      viewer.setAttribute(name, 'false');
      viewer.setAttribute(name, 'off');
      expect(viewer[name]).toBe(true);
    }
  );

  it.each(['minimap', 'controls'] as const)(
    'shows %s again once the attribute is removed',
    name => {
      const viewer = mountViewer({ [name]: 'false' });

      viewer.removeAttribute(name);

      expect(viewer[name]).toBe(true);
    }
  );
});

describe('<erd-viewer> root', () => {
  it('renders one root the Tab key reaches, in a closed shadow root', () => {
    const viewer = mountViewer();
    const shadow = shadowOf(viewer);

    expect(viewer.shadowRoot).toBeNull();
    expect(shadow.mode).toBe('closed');
    expect(shadow.children).toHaveLength(1);
    expect(shadow.firstElementChild?.getAttribute('tabindex')).toBe('0');
  });

  it('takes no focus on mount', () => {
    mountViewer();

    expect(document.activeElement).toBe(document.body);
  });
});

describe('<erd-viewer> value', () => {
  it('holds an empty document before any value is set', () => {
    const viewer = mountViewer();
    const held = JSON.parse(viewer.value);

    expect(held.version).toBe('3.0.0');
    expect(held.doc).toEqual({});
    expect(held.collections).toBeUndefined();
  });

  it('reads a document back in the form a file saves', () => {
    const viewer = mountViewer();

    viewer.value = USERS_FILE;

    expect(viewer.value).toBe(toDocumentJson(parser(USERS_FILE)));
    expect(JSON.parse(viewer.value).doc.tableIds).toEqual(['users']);
  });

  it('replaces the document it held with the next value', () => {
    const viewer = mountViewer();

    viewer.value = USERS_FILE;
    viewer.value = '';

    expect(JSON.parse(viewer.value).doc).toEqual({});
  });

  it('keeps a value set before the element connects', () => {
    const viewer = document.createElement('erd-viewer');

    viewer.value = USERS_FILE;
    document.body.append(viewer);

    expect(JSON.parse(viewer.value).doc.tableIds).toEqual(['users']);
  });
});

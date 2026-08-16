import { describe, expect, it } from 'vite-plus/test';

import { fragmentHostBridge, getFragmentHost } from '@/render/host';

describe('render/host', () => {
  it('exposes the shadow root host through the fragment', () => {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const fragment = document.createDocumentFragment();

    fragmentHostBridge(fragment, shadowRoot);

    expect(getFragmentHost(fragment)).toBe(host);
  });

  it('removes the bridge when the returned dispose is called', () => {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const fragment = document.createDocumentFragment();

    const dispose = fragmentHostBridge(fragment, shadowRoot);
    expect(getFragmentHost(fragment)).toBe(host);

    dispose();

    expect(getFragmentHost(fragment)).toBeNull();
  });

  it('stores the host on a symbol key so no string property leaks', () => {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const fragment = document.createDocumentFragment();

    const before = Object.getOwnPropertySymbols(fragment).length;
    const dispose = fragmentHostBridge(fragment, shadowRoot);

    expect(Object.getOwnPropertySymbols(fragment).length).toBe(before + 1);
    expect(Object.keys(fragment)).toEqual([]);

    dispose();

    expect(Object.getOwnPropertySymbols(fragment).length).toBe(before);
  });

  it('does not bridge when the root is not a shadow root', () => {
    const fragment = document.createDocumentFragment();

    const dispose = fragmentHostBridge(fragment, document.createElement('div'));

    expect(getFragmentHost(fragment)).toBeNull();
    expect(() => dispose()).not.toThrow();
    expect(getFragmentHost(fragment)).toBeNull();
  });

  it('does not bridge for a document fragment root', () => {
    const fragment = document.createDocumentFragment();

    fragmentHostBridge(fragment, document.createDocumentFragment());

    expect(getFragmentHost(fragment)).toBeNull();
  });

  it('returns null for a fragment that was never bridged', () => {
    expect(getFragmentHost(document.createDocumentFragment())).toBeNull();
  });

  it('keeps bridges independent per fragment', () => {
    const hostA = document.createElement('div');
    const hostB = document.createElement('section');
    const fragmentA = document.createDocumentFragment();
    const fragmentB = document.createDocumentFragment();

    const disposeA = fragmentHostBridge(
      fragmentA,
      hostA.attachShadow({ mode: 'open' })
    );
    fragmentHostBridge(fragmentB, hostB.attachShadow({ mode: 'open' }));

    disposeA();

    expect(getFragmentHost(fragmentA)).toBeNull();
    expect(getFragmentHost(fragmentB)).toBe(hostB);
  });

  it('overwrites a previous bridge when re-bridged to another shadow root', () => {
    const hostA = document.createElement('div');
    const hostB = document.createElement('section');
    const fragment = document.createDocumentFragment();

    fragmentHostBridge(fragment, hostA.attachShadow({ mode: 'open' }));
    fragmentHostBridge(fragment, hostB.attachShadow({ mode: 'open' }));

    expect(getFragmentHost(fragment)).toBe(hostB);
  });
});

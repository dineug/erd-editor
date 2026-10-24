import '@/erd-viewer';

import type { JSX } from '@dineug/r-html/jsx-runtime';
import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import {
  defineErdViewer,
  ErdViewerElement,
} from '@/components/erd-viewer/ErdViewer';
import * as index from '@/index';

describe('@dineug/erd-editor/erd-viewer.js', () => {
  it('defines <erd-viewer> as the exported class', () => {
    expect(customElements.get('erd-viewer')).toBe(ErdViewerElement);
  });

  it('leaves <erd-editor> undefined', () => {
    expect(customElements.get('erd-editor')).toBeUndefined();
  });

  it('upgrades a created element into the defined class', () => {
    const viewer = document.createElement('erd-viewer');

    expect(viewer).toBeInstanceOf(ErdViewerElement);
    expect(viewer).toBeInstanceOf(HTMLElement);
    expect(viewer.tagName.toLowerCase()).toBe('erd-viewer');
    expectTypeOf(viewer).toEqualTypeOf<ErdViewerElement>();
    expectTypeOf<
      HTMLElementTagNameMap['erd-viewer']
    >().toEqualTypeOf<ErdViewerElement>();
  });

  it('constructs the class with new once the tag is defined', () => {
    const viewer = new ErdViewerElement();

    expect(viewer).toBeInstanceOf(ErdViewerElement);
    expect(viewer.tagName.toLowerCase()).toBe('erd-viewer');
    expectTypeOf<
      InstanceType<typeof ErdViewerElement>
    >().toEqualTypeOf<ErdViewerElement>();
  });

  it('observes the minimap and controls attributes, which the JSX tag takes', () => {
    expect(ErdViewerElement.observedAttributes).toEqual([
      'minimap',
      'controls',
    ]);
    expectTypeOf<
      JSX.IntrinsicElements['erd-viewer']['minimap']
    >().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<
      JSX.IntrinsicElements['erd-viewer']['controls']
    >().toEqualTypeOf<boolean | undefined>();
  });

  it('leaves the definition as it is when defineErdViewer runs again', () => {
    expect(() => defineErdViewer()).not.toThrow();
    expect(() => defineErdViewer()).not.toThrow();
    expect(customElements.get('erd-viewer')).toBe(ErdViewerElement);
  });

  it('shares its class with the package root, whose defineErdViewer is then quiet too', () => {
    expect(index.ErdViewerElement).toBe(ErdViewerElement);
    expect(() => index.defineErdViewer()).not.toThrow();
    expect(customElements.get('erd-viewer')).toBe(ErdViewerElement);
    expect(customElements.get('erd-editor')).toBeUndefined();
  });
});

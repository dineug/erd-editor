// @vitest-environment node

import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import {
  toSvg as toSvgFromModule,
  type ToSvgOptions as ModuleOptions,
} from '@/services/export-png/toSvg';
import type { ToSvgOptions } from '@/svg';
import * as svg from '@/svg';

describe('@dineug/erd-editor/svg.js', () => {
  it('exports toSvg alone, from its own module', () => {
    expect(Object.keys(svg).sort()).toEqual(['toSvg']);
    expect(svg.toSvg).toBe(toSvgFromModule);
    expectTypeOf<ToSvgOptions>().toEqualTypeOf<ModuleOptions>();
  });

  it('installs nothing as it is imported, before toSvg is first called', () => {
    for (const name of ['document', 'OffscreenCanvas', 'Node', 'HTMLElement']) {
      expect(Reflect.get(globalThis, name)).toBeUndefined();
    }
  });

  it('types its options as the two switches an svg reads', () => {
    expectTypeOf(svg.toSvg).parameters.toEqualTypeOf<
      [value: string, options?: ToSvgOptions]
    >();
    expectTypeOf(svg.toSvg).returns.resolves.toBeString();
    expectTypeOf<keyof ToSvgOptions>().toEqualTypeOf<
      'background' | 'darkMode'
    >();
  });
});

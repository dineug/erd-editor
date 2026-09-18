/** @jsxHost konva */

// AC-70 (i): the particle layer's template is one childless k-layer. The
// host's ledger owns every child a template writes, and a reconcile of this
// layer would drop the circles the loop adds behind it, so the source is pinned.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { useProvider } from '@dineug/r-html';
import { Stage } from 'konva/lib/Stage';
import { describe, expect, it, vi } from 'vite-plus/test';

import { createTestAppContext, createTestTheme } from '@/__test-utils__';
import { appContext } from '@/components/appContext';
import { themeContext } from '@/components/themeContext';
import { renderKonva } from '@/konva/host';

import ParticleLayer from './ParticleLayer';

const hoisted = vi.hoisted(() => ({ loops: 0 }));

/**
 * The loop itself is exercised by the mounted specs beside this one; here it
 * is only counted, since this file is about the guard that stands before it
 * ever runs.
 */
vi.mock('./particleLoop', async importOriginal => {
  const actual = await importOriginal<typeof import('./particleLoop')>();
  return {
    ...actual,
    createParticleLoop: (
      ...args: Parameters<typeof actual.createParticleLoop>
    ) => {
      hoisted.loops += 1;
      return actual.createParticleLoop(...args);
    },
  };
});

/**
 * A ref the way a host with no use:ref support would leave one: whatever a
 * directive writes to it, the getter answers undefined.
 */
vi.mock('@dineug/r-html', async importOriginal => {
  const actual = await importOriginal<typeof import('@dineug/r-html')>();
  return {
    ...actual,
    createRef: () => ({
      get value() {
        return undefined;
      },
      set value(_next: unknown) {},
    }),
  };
});

const LAYER_FILE = join(
  process.cwd(),
  'src',
  'components',
  'visualization',
  'particles',
  'ParticleLayer.tsx'
);

const source = readFileSync(LAYER_FILE, 'utf8');

/** The one tag the template opens, with everything up to its close. */
const layerTag = () => /<k-layer\b([^<>]*)\/>/.exec(source);

describe('the particle layer template (AC-70)', () => {
  it('renders one k-layer and nothing under it', () => {
    expect(source.match(/<k-[a-z]+/g)).toEqual(['<k-layer']);
    expect(layerTag()).not.toBeNull();
    expect(source).not.toContain('</k-layer>');
    expect(source).not.toContain('{props.children}');
  });

  it('names the layer, closes it to the pointer, and hands its node to the loop by ref', () => {
    const [, attributes] = layerTag()!;

    expect(attributes).toContain('name="view-particles"');
    expect(attributes).toContain('listening={false}');
    expect(attributes).toContain('use:ref=');
    // Constant attributes alone: nothing here reads the store, so no commit
    // after the first ever marks the layer dirty.
    expect(attributes).not.toMatch(/\b(x|y|scaleX|scaleY|opacity)=/);
  });

  it('read the file the scene mounts', () => {
    expect(source).toContain('/** @jsxHost konva */');
    expect(source).toContain('createParticleLoop(');
  });
});

describe('the particle layer mounted where its ref never resolves', () => {
  it('sets up no loop and throws nothing, standing on the guard alone', () => {
    const app = createTestAppContext();
    const container = document.createElement('div');
    document.body.append(container);
    const appProvider = useProvider(container as any, appContext, app);
    const themeProvider = useProvider(
      container as any,
      themeContext,
      createTestTheme()
    );
    const stage = new Stage({ container, width: 100, height: 100 });

    expect(() => renderKonva(stage, <ParticleLayer />)).not.toThrow();
    expect(hoisted.loops).toBe(0);

    renderKonva(stage, null);
    stage.destroy();
    appProvider.destroy();
    themeProvider.destroy();
    container.remove();
  });
});

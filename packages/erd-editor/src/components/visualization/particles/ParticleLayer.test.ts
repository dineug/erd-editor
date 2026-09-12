// AC-70 (i): the particle layer's template is one childless k-layer. The
// host's ledger owns every child a template writes, and a reconcile of this
// layer would drop the circles the loop adds behind it, so the source is pinned.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

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

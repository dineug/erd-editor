import { describe, expect, it } from 'vite-plus/test';

import { getIcon } from '@/components/primitives/icon/icons';
import { RelationshipType } from '@/constants/schema';
import { getRelationshipIcon, toCursorImage } from '@/utils/icon';

const PREFIX = 'data:image/svg+xml,';

const attributes = (element: Element) =>
  Object.fromEntries(
    Array.from(element.attributes).map(attr => [attr.name, attr.value])
  );

/** The cursor image back as a parsed svg root, the way the browser reads it. */
function parse(uri: string | null): SVGSVGElement {
  expect(uri?.startsWith(PREFIX)).toBe(true);

  const host = document.createElement('div');
  host.innerHTML = decodeURIComponent(uri!.slice(PREFIX.length));
  const svg = host.querySelector('svg');
  expect(svg).not.toBeNull();

  return svg!;
}

const layers = (svg: SVGSVGElement) => Array.from(svg.querySelectorAll('g'));

const drawn = (layer: Element) =>
  Array.from(layer.children).map(child => [child.tagName, attributes(child)]);

const glyph = (name: string) =>
  getIcon(name)!.node.map(([tag, attrs]) => [tag, attrs]);

describe('getRelationshipIcon', () => {
  it.each([
    [RelationshipType.ZeroOne, 'ZeroOne'],
    [RelationshipType.ZeroN, 'ZeroN'],
    [RelationshipType.OneOnly, 'OneOnly'],
    [RelationshipType.OneN, 'OneN'],
  ])('serializes v3 relationship type %d from the %s glyph', (type, name) => {
    const drawnLayers = layers(parse(getRelationshipIcon(type, false)));

    expect(drawnLayers.length).toBe(2);
    for (const layer of drawnLayers) {
      expect(drawn(layer)).toEqual(glyph(name));
    }
  });

  it.each([
    [1, 'ZeroOneN'],
    [32, 'One'],
    [64, 'N'],
  ])('still resolves the deprecated v2 relationship type %d', (type, name) => {
    const drawnLayers = layers(parse(getRelationshipIcon(type, false)));

    expect(drawnLayers.length).toBe(2);
    for (const layer of drawnLayers) {
      expect(drawn(layer)).toEqual(glyph(name));
    }
  });

  it('rasterizes into a 32px box whose centre Erd.tsx names as the hotspot, with the caps and joins Icon.tsx draws with', () => {
    const svg = parse(getRelationshipIcon(RelationshipType.ZeroN, false));

    expect(attributes(svg)).toEqual({
      xmlns: 'http://www.w3.org/2000/svg',
      width: '32',
      height: '32',
      viewBox: '0 0 24 24',
      fill: 'none',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
  });

  it('draws black ink over a white halo twice its width on a light appearance', () => {
    const svg = parse(getRelationshipIcon(RelationshipType.ZeroN, false));

    expect(layers(svg).map(attributes)).toEqual([
      { stroke: '#fff', 'stroke-width': '4' },
      { stroke: '#000', 'stroke-width': '2' },
    ]);
    expect(Array.from(svg.children).map(child => child.tagName)).toEqual([
      'g',
      'g',
    ]);
  });

  it('swaps to white ink over a black halo on a dark appearance', () => {
    const svg = parse(getRelationshipIcon(RelationshipType.ZeroN, true));

    expect(layers(svg).map(attributes)).toEqual([
      { stroke: '#000', 'stroke-width': '4' },
      { stroke: '#fff', 'stroke-width': '2' },
    ]);
  });

  it('leaves nothing a css url() or a data uri would read as its own syntax', () => {
    const uri = getRelationshipIcon(RelationshipType.OneN, false)!;

    // A raw # starts the fragment, a raw quote ends the url() string.
    expect(uri).not.toMatch(/["#<>]/);
    expect(decodeURIComponent(uri.slice(PREFIX.length))).toContain('#000');
  });

  it('escapes an attribute value that would otherwise end the attribute or open a tag', () => {
    const svg = parse(toCursorImage([['path', { d: 'M0 0"<&' }]], false));

    for (const layer of layers(svg)) {
      expect(drawn(layer)).toEqual([['path', { d: 'M0 0"<&' }]]);
    }
  });

  it('leaves an undefined attribute out rather than writing the word', () => {
    const svg = parse(
      toCursorImage([['path', { d: 'M0 0', fill: undefined }]], false)
    );

    expect(drawn(layers(svg)[0])).toEqual([['path', { d: 'M0 0' }]]);
  });

  it('returns null for an unknown relationship type', () => {
    expect(getRelationshipIcon(0, false)).toBeNull();
    expect(getRelationshipIcon(128, true)).toBeNull();
    expect(getRelationshipIcon(-1, false)).toBeNull();
    expect(getRelationshipIcon(3, true)).toBeNull();
  });
});

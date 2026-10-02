import { iconMap, type IconName } from '@/components/primitives/icon/icons';

/** A shape as a spec can compare it: its tag, and for a path its data, which tells one glyph from another. */
const shapeKey = (tag: string, d: unknown) =>
  `${tag.toLowerCase()}:${tag.toLowerCase() === 'path' ? String(d) : ''}`;

/**
 * The name of the registered icon the first svg inside an element draws, read
 * off its shapes, or null when it draws none or one the registry does not hold.
 */
export function iconNameOf(el: Element | null | undefined): IconName | null {
  const svg = el?.querySelector('svg');
  if (!svg) return null;

  const drawn = Array.from(svg.children).map(shape =>
    shapeKey(shape.tagName, shape.getAttribute('d'))
  );
  const found = Object.values(iconMap).find(({ node }) => {
    const shapes = node.map(([tag, attrs]) => shapeKey(tag, attrs.d));
    return (
      shapes.length === drawn.length &&
      shapes.every((shape, index) => shape === drawn[index])
    );
  });
  return found?.name ?? null;
}

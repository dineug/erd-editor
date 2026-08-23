import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/canvas/duplicate-ghost/DuplicateGhost.styles';

const staticText = (literals: { strings: TemplateStringsArray }) =>
  [...literals.strings].join(' ');

describe('DuplicateGhost.styles', () => {
  it('exports both tokens as css templates', () => {
    expect(styles.ghostLayer.toString().length).toBeGreaterThan(0);
    expect(styles.ghostItem.toString().length).toBeGreaterThan(0);
  });

  it('spans the canvas without displacing the ghosts', () => {
    // The ghosts are `<Table>`/`<Memo>` positioning themselves absolutely from
    // their own `ui.x`/`ui.y`. `inset: 0` with no `position` of its own leaves
    // them resolving against the canvas root, exactly as the originals do.
    const text = staticText(styles.ghostLayer);
    expect(text).toContain('position: absolute');
    expect(text).toContain('inset: 0');
  });

  it('pins the layer above every entity z-index', () => {
    // Tables and memos paint at their own `ui.zIndex`, which grows without
    // bound as entities are brought forward, so the layer cannot rely on
    // document order. Both `transform` and `opacity < 1` open a stacking
    // context here, which is what keeps the ghosts' own z-index values from
    // escaping it.
    expect(staticText(styles.ghostLayer)).toContain('z-index: 2147483647');
  });

  it('keeps the layer out of hit-testing', () => {
    // The layer sits under the cursor for the whole gesture; catching pointer
    // events would shadow the entity being dragged. It is also what makes
    // rendering a second `<Table>` safe — `useMoveTable`'s `onMoveStart` is on
    // that markup and can never be reached.
    expect(staticText(styles.ghostLayer)).toContain('pointer-events: none');
  });

  it('draws the layer translucent, not each ghost', () => {
    // Per-entity opacity would compound where ghosts overlap, turning a dragged
    // cluster into opaque patches.
    expect(staticText(styles.ghostLayer)).toContain('opacity:');
    expect(staticText(styles.ghostItem)).not.toContain('opacity:');
  });

  it('gives the per-entity marker no box of its own', () => {
    // The marker exists only to carry `data-id` / `data-select-type`, which
    // `<Table>` and `<Memo>` cannot be given from outside. Any box here would
    // become the containing block for the absolutely positioned entity inside
    // it and break the coordinates.
    expect(staticText(styles.ghostItem)).toContain('display: contents');
  });
});

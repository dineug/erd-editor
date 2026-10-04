import { describe, expect, it, vi } from 'vite-plus/test';

import {
  DOCUMENT_CARD_SHADOW_BLUR,
  DOCUMENT_CARD_SHADOW_OFFSET_Y,
  documentCardShadow,
  mainButtonClick,
  type SceneMouseEvent,
} from '@/components/erd/canvas/sceneTokens';

describe('documentCardShadow', () => {
  it('casts the document shadow in a colour carrying alpha', () => {
    expect(documentCardShadow('rgba(0, 0, 0, 0.18)')).toEqual({
      color: 'rgba(0, 0, 0, 0.18)',
      blur: DOCUMENT_CARD_SHADOW_BLUR,
      offsetX: 0,
      offsetY: DOCUMENT_CARD_SHADOW_OFFSET_Y,
      opacity: 1,
    });
  });

  it('casts none for the palette transparent, and for a none or blank override', () => {
    for (const off of ['transparent', 'none', ' none ', '', '   ']) {
      expect(documentCardShadow(off), JSON.stringify(off)).toBeNull();
    }
  });

  it('casts none where no theme above the scene gave it a token', () => {
    expect(documentCardShadow(undefined)).toBeNull();
  });
});

/** A click as konva hands one to a node, carrying the lift of the button it names. */
const clickOf = (init: MouseEventInit) =>
  ({ evt: new MouseEvent('click', init) }) as SceneMouseEvent;

describe('mainButtonClick', () => {
  it('acts on a click of the main button, a held control included', () => {
    const click = vi.fn();
    const listener = mainButtonClick(click);
    const main = clickOf({ button: 0 });
    // A Mac Ctrl+click is the main button with control held, not a right click.
    const controlled = clickOf({ button: 0, ctrlKey: true });

    listener(main);
    listener(controlled);

    expect(click.mock.calls).toEqual([[main], [controlled]]);
  });

  it('does nothing for a click of the right or the middle button', () => {
    const click = vi.fn();
    const listener = mainButtonClick(click);

    listener(clickOf({ button: 2 }));
    listener(clickOf({ button: 1 }));

    expect(click).not.toHaveBeenCalled();
  });
});

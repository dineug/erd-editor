import { describe, expect, it } from 'vite-plus/test';

import {
  DOCUMENT_CARD_SHADOW_BLUR,
  DOCUMENT_CARD_SHADOW_OFFSET_Y,
  documentCardShadow,
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

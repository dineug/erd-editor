import { round } from 'es-toolkit/compat';

import { Settings } from '@/v3/schema/settings';

export type LegacyScrollBox = Pick<
  Settings,
  'width' | 'height' | 'zoomLevel' | 'scrollLeft' | 'scrollTop'
>;

export type Origin = Pick<Settings, 'originX' | 'originY'>;

const boxTerm = (length: number, zoomLevel: number) =>
  (length * (1 - zoomLevel)) / 2;

/**
 * Turns the legacy scroll pair, measured from the canvas box centred in the
 * viewport, into the origin a document without an origin pair had. The one
 * place the legacy pair is read, and the only direction that exists.
 */
export function migrateScrollToOrigin(box: LegacyScrollBox): Origin {
  return {
    originX: round(box.scrollLeft + boxTerm(box.width, box.zoomLevel), 4),
    originY: round(box.scrollTop + boxTerm(box.height, box.zoomLevel), 4),
  };
}

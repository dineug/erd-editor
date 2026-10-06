import {
  ARROW_DOWN_BOX,
  ARROW_UP_BOX,
} from '@/components/erd/welcome-screen/welcomeLayout';

/**
 * A pen stroke that leaves the label low on the left and bows up to a tip
 * near the top right, where both barbs meet it, at the tip ARROW_UP_BOX names.
 */
export const ARROW_UP = [
  'M6 69C3.5 50 13.5 31 27 17.5C30.5 13.5 33.6 8.7 36 3',
  'M27.6 8.6Q31.8 5.6 36 3Q36.9 7.9 38.4 12.6',
] as const;

/** A pen stroke that wavers down from under the label to a tip at the bottom middle. */
export const ARROW_DOWN = [
  'M15 3C8.5 15.5 27.5 25 21.5 39C20.5 43.5 20.2 48 20 53',
  'M13.8 45.2Q17.2 48.8 20 53Q22.6 48.6 26.2 45',
] as const;

type ArrowBox = { readonly width: number; readonly height: number };

/**
 * One arrow, stroked from currentColor by attributes, never a stylesheet;
 * mirrored, it is flipped across its own middle, so its tip lands as far in
 * from the left as it stood from the right.
 */
const arrow = (
  box: ArrowBox,
  paths: ReadonlyArray<string>,
  mirrored: boolean
) => (
  <svg
    class="welcome-screen-arrow"
    width={box.width}
    height={box.height}
    viewBox={`0 0 ${box.width} ${box.height}`}
    aria-hidden="true"
  >
    <g transform={mirrored ? `matrix(-1 0 0 1 ${box.width} 0)` : ''}>
      {paths.map(d => (
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        ></path>
      ))}
    </g>
  </svg>
);

export const arrowUp = (mirrored: boolean) =>
  arrow(ARROW_UP_BOX, ARROW_UP, mirrored);

export const arrowDown = () => arrow(ARROW_DOWN_BOX, ARROW_DOWN, false);
